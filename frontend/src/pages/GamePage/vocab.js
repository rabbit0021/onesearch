// 210 words — leaves ~44 slots for user additions before the 254-word Jev cap
export const DEFAULT_VOCAB = [
  // glue (14)
  'a','the','an','in','on','at','to','of','for','by','with','into','from','about',
  // pronouns (12)
  'I','he','she','they','it','we','you','me','him','her','his','their',
  // setup (8)
  'why','what','how','where','who','when','did','knock',
  // connectors (14)
  'because','but','and','so','then','or','yet','however','although','while',
  'after','before','if','since',
  // auxiliaries (12)
  'is','was','are','were','be','has','have','had','will','would','could','can',
  // verbs (36)
  'walk','run','go','went','come','say','said','ask','tell','look','see','saw',
  'hear','feel','think','know','want','get','got','give','take','make','put',
  'turn','leave','open','start','stop','fall','buy','eat','find','lose','sit',
  'laugh','die',
  // adverbs (16)
  'not','never','always','very','really','just','only','even','still','almost',
  'again','maybe','quickly','slowly','actually','away',
  // quantifiers (10)
  'no','yes','one','two','three','some','any','all','every','more',
  // people (24)
  'man','woman','guy','person','friend','stranger','doctor','nurse','lawyer','judge',
  'priest','rabbi','pilot','chef','waiter','bartender','boss','teacher','student',
  'detective','officer','king','queen','ghost',
  // animals (16)
  'duck','chicken','dog','cat','horse','cow','bear','elephant','penguin','parrot',
  'shark','frog','owl','monkey','lion','rabbit',
  // places (16)
  'bar','office','hospital','restaurant','store','hotel','school','church','bank',
  'park','beach','forest','heaven','hell','zoo','airport',
  // objects (14)
  'door','phone','key','hat','sandwich','bottle','glass','clock','money','coffee',
  'beer','wine','cake','bread',
  // adjectives (24)
  'dead','alive','happy','sad','angry','confused','tired','hungry','excited','scared',
  'big','small','old','new','good','bad','great','terrible','fast','slow','funny',
  'strange','stupid','smart',
  // punctuation (5) — keep at end, backend strips last N if needed
  '.','!','?',',','...',
]
