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
}
