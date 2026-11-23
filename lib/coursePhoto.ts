import { useEffect, useState } from 'react';
import { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Course photos from Wikimedia Commons (free licences, searchable by course name).
// Courses with no usable photo get the bundled one (CC0, no credit needed).

export interface CoursePhoto {
  source: ImageSourcePropType;
  credit?: string; // "Photo: <author>, <licence>" (CC BY/BY-SA require it)
  href?: string; // the file's Commons page (licence + author)
}

export const DEFAULT_PHOTO: CoursePhoto = { source: require('../assets/course-default.jpg') };

const LICENCES = /^(CC0|Public domain|CC BY(-SA)? \d)/i;
const JUNK =
  /plaque|logo|map|sign|clubhouse|scorecard|flies|aircraft|statue|portrait|trophy|award|memorial stone|hotel|car\b|bus\b|\.(svg|png|gif|tif)/i;
const GOOD = /hole|green|fairway|tee|course|links|bunker/i;
const STOP = new Set(['the', 'golf', 'club', 'course', 'links', 'country', 'cc', 'gc', 'resort', 'and', 'at', 'of', '&', '-', '–']);

interface CommonsPage {
  title: string;
  index: number;
  imageinfo?: {
    width: number;
    height: number;
    thumburl: string;
    descriptionurl: string;
    extmetadata?: Record<string, { value: string } | undefined>;
  }[];
}

const strip = (html = '') =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// The words that identify this course (not "golf", "club" …), from the club part of "Club – Course".
export function keyWords(courseName: string): string[] {
  const club = courseName.split(/ [–-] /)[0];
  return club
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

// Best landscape photo of this course among Commons search results, or undefined.
export function pickPhoto(courseName: string, pages: CommonsPage[]): CoursePhoto | undefined {
  const words = keyWords(courseName);
  if (!words.length) return undefined;
  const ok = pages
    .filter((p) => {
      const i = p.imageinfo?.[0];
      const title = p.title.toLowerCase();
      const licence = i?.extmetadata?.LicenseShortName?.value ?? '';
      return (
        i &&
        i.width >= 1000 &&
        i.width >= i.height * 1.25 &&
        LICENCES.test(licence) &&
        !JUNK.test(title) &&
        words.every((w) => title.includes(w))
      );
    })
    .sort((a, b) => Number(GOOD.test(b.title)) - Number(GOOD.test(a.title)) || a.index - b.index);
  const best = ok[0]?.imageinfo?.[0];
  if (!best) return undefined;
  const m = best.extmetadata ?? {};
  const author = strip(m.Artist?.value).slice(0, 60) || 'Wikimedia Commons';
  return { source: { uri: best.thumburl }, credit: `Photo: ${author}, ${m.LicenseShortName?.value}`, href: best.descriptionurl };
}

async function search(courseName: string): Promise<CoursePhoto | undefined> {
  const club = courseName.split(/ [–-] /)[0];
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=15' +
    `&gsrsearch=${encodeURIComponent(`${club} golf filetype:bitmap`)}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1280` +
    '&iiextmetadatafilter=Artist|LicenseShortName';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  const json = await res.json();
  return pickPhoto(courseName, Object.values(json?.query?.pages ?? {}) as CommonsPage[]);
}

const memory = new Map<string, CoursePhoto>();
type Saved = { uri: string; credit?: string; href?: string } | null;

// The course's photo: cached on the device; the default photo until (or unless) one is found.
export function useCoursePhoto(courseName?: string): CoursePhoto {
  const key = courseName?.trim() ? `coursePhoto:v1:${courseName.trim().toLowerCase()}` : '';
  const [photo, setPhoto] = useState<CoursePhoto>(() => memory.get(key) ?? DEFAULT_PHOTO);
  useEffect(() => {
    if (!key || !courseName) return setPhoto(DEFAULT_PHOTO);
    const hit = memory.get(key);
    if (hit) return setPhoto(hit);
    let live = true;
    (async () => {
      const raw = await AsyncStorage.getItem(key).catch(() => null);
      let found: CoursePhoto;
      if (raw !== null) {
        const saved = JSON.parse(raw) as Saved;
        found = saved ? { source: { uri: saved.uri }, credit: saved.credit, href: saved.href } : DEFAULT_PHOTO;
      } else {
        const p = await search(courseName).catch(() => undefined);
        found = p ?? DEFAULT_PHOTO;
        // shortcut: "no photo" is cached forever on this device; add an expiry if Commons coverage matters.
        const save: Saved = p ? { uri: (p.source as { uri: string }).uri, credit: p.credit, href: p.href } : null;
        AsyncStorage.setItem(key, JSON.stringify(save)).catch(() => {});
      }
      memory.set(key, found);
      if (live) setPhoto(found);
    })();
    return () => {
      live = false;
    };
  }, [key]);
  return photo;
}

function selfCheck() {
  const page = (title: string, licence = 'CC BY-SA 4.0', width = 2000, height = 1300, index = 1): CommonsPage => ({
    title,
    index,
    imageinfo: [
      {
        width,
        height,
        thumburl: `u/${title}`,
        descriptionurl: 'd',
        extmetadata: { LicenseShortName: { value: licence }, Artist: { value: '<a>Ann</a>' } },
      },
    ],
  });
  const pages = [
    page('File:Pebble Beach Golf Links plaque.jpg', 'CC BY-SA 4.0', 2000, 1300, 1),
    page('File:Pebble Beach Golf Links, 18th green.jpg', 'CC BY-SA 4.0', 3264, 2448, 2),
    page('File:Pebble Beach lodge.jpg', 'All rights reserved', 2000, 1300, 3),
  ];
  const got = pickPhoto('Pebble Beach Golf Links – Pebble Beach Golf Links', pages);
  console.assert(
    (got?.source as { uri: string })?.uri === 'u/File:Pebble Beach Golf Links, 18th green.jpg',
    'coursePhoto: picks the green, skips the plaque',
  );
  console.assert(got?.credit === 'Photo: Ann, CC BY-SA 4.0', 'coursePhoto: credits author and licence');
  console.assert(!pickPhoto('Torrey Pines', [page('File:Pine tree.jpg')]), 'coursePhoto: needs every key word in the title');
  console.assert(!pickPhoto('Golf Club', pages), 'coursePhoto: no key words, no guess');
  console.assert(
    !pickPhoto('Bandon Dunes', [page('File:Bandon Dunes 4th hole.jpg', 'CC BY-SA 4.0', 720, 480)]),
    'coursePhoto: skips small photos',
  );
}
selfCheck();
