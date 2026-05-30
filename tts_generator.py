"""
Google Cloud Text-to-Speech generator for article content.
Parses article HTML into SSML with per-word <mark> tags,
calls the Neural2 API, and returns word timings for frontend sync.
"""
import os
import re
import html as html_module
from bs4 import BeautifulSoup, NavigableString
from google.cloud import texttospeech_v1beta1 as texttospeech

VOICE_NAME     = "en-US-Neural2-F"
LANGUAGE_CODE  = "en-US"
SPEAKING_RATE  = 1.0
# v1beta1 limit is 5000 bytes per request (much lower than v1)
MAX_SSML_BYTES = 4_500


def html_to_ssml(html: str) -> tuple[str, list[str]]:
    """
    Parse article HTML and produce SSML with per-word <mark> tags.
    Returns (ssml_string, words_list) where words_list[i] is the word
    spoken at mark "w{i}".

    Rules:
    - <img>, <figure>, <figcaption>, <svg>, <script>, <style> → skipped
    - <pre>, <code> → replaced with "Code block."
    - <h1>/<h2>/<h3> → wrapped in <prosody rate="95%"> + pauses
    - <h4>/<h5>/<h6> → short pause before/after
    - <blockquote> → short pause before/after
    - <p>, <li> → break after
    - <table> → converted to "Table. Column headers: ... Row: ..."
    - All other text → word-by-word marks
    """
    soup = BeautifulSoup(html, "html.parser")
    parts = []
    words = []

    def add_text(text: str):
        text = text.strip()
        if not text:
            return
        for word in re.split(r"\s+", text):
            if word:
                escaped = html_module.escape(word)
                parts.append(f'<mark name="w{len(words)}"/>{escaped} ')
                words.append(word)

    def walk_table(table):
        parts.append('<break time="300ms"/>')
        for i, row in enumerate(table.find_all("tr")):
            cells = row.find_all(["th", "td"])
            if i == 0:
                col_text = ", ".join(c.get_text(" ", strip=True) for c in cells)
                add_text(f"Table. Column headers: {col_text}.")
            else:
                row_text = ", ".join(c.get_text(" ", strip=True) for c in cells)
                add_text(f"Row: {row_text}.")
            parts.append('<break time="150ms"/>')
        parts.append('<break time="300ms"/>')

    def walk(el):
        if isinstance(el, NavigableString):
            add_text(str(el))
            return

        tag = getattr(el, "name", None)
        if tag in ("script", "style", "img", "figure", "figcaption", "svg", "noscript", "button"):
            return
        if tag in ("pre", "code"):
            parts.append('<break time="200ms"/>Code block.<break time="200ms"/>')
            return
        if tag == "table":
            walk_table(el)
            return
        if tag in ("h1", "h2", "h3"):
            parts.append('<break time="600ms"/><prosody rate="95%">')
            for child in el.children:
                walk(child)
            parts.append('</prosody><break time="400ms"/>')
            return
        if tag in ("h4", "h5", "h6"):
            parts.append('<break time="350ms"/>')
            for child in el.children:
                walk(child)
            parts.append('<break time="250ms"/>')
            return
        if tag == "blockquote":
            parts.append('<break time="300ms"/>')
            for child in el.children:
                walk(child)
            parts.append('<break time="300ms"/>')
            return
        if tag in ("p", "li"):
            for child in el.children:
                walk(child)
            parts.append('<break time="300ms"/>')
            return

        for child in el.children:
            walk(child)

    walk(soup)
    ssml = "<speak>" + "".join(parts) + "</speak>"
    return ssml, words


def _call_tts(ssml: str, client, voice, audio_config) -> tuple[bytes, list]:
    """Single TTS API call. Returns (audio_bytes, timepoints)."""
    import logging
    logging.getLogger(__name__).debug("SSML chunk (%d bytes): %s", len(ssml.encode()), ssml[:500])
    request = texttospeech.SynthesizeSpeechRequest(
        input=texttospeech.SynthesisInput(ssml=ssml),
        voice=voice,
        audio_config=audio_config,
        enable_time_pointing=[texttospeech.SynthesizeSpeechRequest.TimepointType.SSML_MARK],
    )
    response = client.synthesize_speech(request=request)
    return response.audio_content, response.timepoints


def generate_tts(html: str, output_path: str) -> list[dict]:
    """
    Generate MP3 audio for the article HTML and save to output_path.
    Returns list of { wordIndex, word, time } dicts for frontend sync.
    word timings are absolute seconds from the start of the audio.
    Handles articles larger than MAX_SSML_BYTES by splitting the structured
    SSML at paragraph/heading break boundaries and concatenating MP3 streams.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    client = texttospeech.TextToSpeechClient()  # v1beta1 for enable_time_pointing support
    voice  = texttospeech.VoiceSelectionParams(language_code=LANGUAGE_CODE, name=VOICE_NAME)
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=SPEAKING_RATE,
    )

    ssml, words = html_to_ssml(html)

    # ── Single request (most articles) ───────────────────────────────────
    if len(ssml.encode("utf-8")) <= MAX_SSML_BYTES:
        audio_bytes, timepoints = _call_tts(ssml, client, voice, audio_config)
        with open(output_path, "wb") as f:
            f.write(audio_bytes)
        return _parse_timings(timepoints, words, offset=0.0)

    # ── Chunked request — split original structured SSML at break boundaries
    # so that prosody/heading/paragraph markup is preserved in every chunk.
    inner    = ssml[len("<speak>"):-len("</speak>")]
    # Split after paragraph (300ms) and post-heading (400ms) breaks — safe
    # split points because prosody tags always close before these breaks.
    segments = re.split(r'(?<=<break time="300ms"/>)|(?<=<break time="400ms"/>)', inner)

    chunk_ssmls = []
    current     = ""
    for seg in segments:
        candidate = current + seg
        if len(("<speak>" + candidate + "</speak>").encode("utf-8")) > MAX_SSML_BYTES and current:
            chunk_ssmls.append("<speak>" + current + "</speak>")
            current = seg
        else:
            current = candidate
    if current:
        chunk_ssmls.append("<speak>" + current + "</speak>")

    all_audio   = b""
    all_timings = []
    time_offset = 0.0

    for chunk_ssml in chunk_ssmls:
        audio_bytes, timepoints = _call_tts(chunk_ssml, client, voice, audio_config)
        all_audio   += audio_bytes
        all_timings += _parse_timings(timepoints, words, offset=time_offset)
        time_offset += len(audio_bytes) / 16_000

    with open(output_path, "wb") as f:
        f.write(all_audio)
    return all_timings


def generate_tts_stream(html: str):
    """
    Streaming version of generate_tts.
    Yields (audio_bytes, chunk_timings, time_offset) for each SSML chunk
    as soon as the TTS API responds, rather than waiting for all chunks.
    """
    client = texttospeech.TextToSpeechClient()
    voice = texttospeech.VoiceSelectionParams(language_code=LANGUAGE_CODE, name=VOICE_NAME)
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=SPEAKING_RATE,
    )

    ssml, words = html_to_ssml(html)
    time_offset = 0.0

    if len(ssml.encode("utf-8")) <= MAX_SSML_BYTES:
        audio_bytes, timepoints = _call_tts(ssml, client, voice, audio_config)
        yield audio_bytes, _parse_timings(timepoints, words, offset=0.0), 0.0
        return

    inner = ssml[len("<speak>"):-len("</speak>")]
    segments = re.split(r'(?<=<break time="300ms"/>)|(?<=<break time="400ms"/>)', inner)

    chunk_ssmls = []
    current = ""
    for seg in segments:
        candidate = current + seg
        if len(("<speak>" + candidate + "</speak>").encode("utf-8")) > MAX_SSML_BYTES and current:
            chunk_ssmls.append("<speak>" + current + "</speak>")
            current = seg
        else:
            current = candidate
    if current:
        chunk_ssmls.append("<speak>" + current + "</speak>")

    for chunk_ssml in chunk_ssmls:
        audio_bytes, timepoints = _call_tts(chunk_ssml, client, voice, audio_config)
        yield audio_bytes, _parse_timings(timepoints, words, offset=time_offset), time_offset
        time_offset += len(audio_bytes) / 16_000


def _parse_timings(timepoints, words: list[str], offset: float) -> list[dict]:
    timings = []
    for tp in timepoints:
        name = tp.mark_name
        if not name.startswith("w"):
            continue
        try:
            idx = int(name[1:])
        except ValueError:
            continue
        timings.append({
            "wordIndex": idx,
            "word":      words[idx] if idx < len(words) else "",
            "time":      round(offset + tp.time_seconds, 3),
        })
    return timings
