/**
 * Static metadata for individual publishers.
 * - image: place the file in /public/individuals/ and reference it here
 * - website: the publisher's personal site
 * - bio: short one-liner shown in the card
 *
 * Key must exactly match the publisher_name stored in the DB.
 */
export const INDIVIDUALS_META = {
  'addy osmani': {
    image: '/individuals/addy-osmani.jpg',
    website: 'https://addyosmani.com',
    bio: 'Engineering Manager at Google Chrome, author on web performance & frontend engineering.',
  },
  'julia evans': {
    image: '/individuals/julia-evans.jpg',
    website: 'https://jvns.ca',
    bio: 'Software engineer and zine author, writes about debugging, networking, and developer tools.',
  },
  'antirez': {
    realName: 'Salvatore Sanfilippo',
    image: '/individuals/antirez.jpg',
    website: 'http://antirez.com',
    bio: 'Creator of Redis. Writes about systems programming, software design, and life as an engineer.',
  },
  'marc brooker': {
    image: '/individuals/marc-brooker.jpg',
    website: 'https://brooker.co.za/blog',
    bio: 'Principal Engineer at AWS. Writes about distributed systems, databases, and cloud infrastructure.',
  },
  'eli bendersky': {
    image: '/individuals/eli-bendersky.jpg',
    website: 'https://eli.thegreenplace.net',
    bio: 'Software engineer at Google. Writes about compilers, systems programming, Go, and Python internals.',
  },
  'simon willison': {
    image: '/individuals/simon-willison.jpg',
    website: 'https://simonwillison.net',
    bio: 'Co-creator of Django. Writes about AI, LLMs, Python, and open source.',
  },
  'gergely orosz': {
    image: '/individuals/gergely-orosz.jpg',
    website: 'https://blog.pragmaticengineer.com',
    bio: 'Author of The Pragmatic Engineer newsletter. Writes about software engineering, engineering management, and the tech industry.',
  },
}
