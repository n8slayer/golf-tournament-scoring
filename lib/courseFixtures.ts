import type { CourseDetail, TeeBox } from './courseApi';

// Made-up courses for test mode (EXPO_PUBLIC_COURSE_API_MOCK=1): same shape as
// GolfCourseAPI responses, zero API requests. Not real courses.

function tee(name: string, pars: number[], strokeIndex: number[], baseYards: number[], scale: number, rating: number, slope: number): TeeBox {
  const holes = pars.map((par, i) => ({ par, handicap: strokeIndex[i], yardage: Math.round(baseYards[i] * scale) }));
  return {
    tee_name: name,
    course_rating: rating,
    slope_rating: slope,
    par_total: pars.reduce((a, b) => a + b, 0),
    total_yards: holes.reduce((a, h) => a + h.yardage, 0),
    holes,
  };
}

const PARS_A = [4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];
const SI_A = [7, 3, 15, 1, 11, 17, 5, 13, 9, 8, 16, 2, 12, 4, 18, 10, 6, 14];
const YDS_A = [410, 545, 175, 440, 385, 160, 560, 395, 420, 405, 190, 530, 375, 455, 150, 400, 575, 430];

const PARS_B = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 3, 4, 4, 5];
const SI_B = [5, 9, 17, 1, 13, 3, 15, 11, 7, 6, 10, 18, 2, 14, 16, 4, 12, 8];
const YDS_B = [380, 360, 140, 520, 345, 415, 185, 330, 505, 395, 350, 125, 545, 320, 170, 430, 365, 510];

export const FIXTURE_COURSES: CourseDetail[] = [
  {
    id: 'test0001',
    club_name: 'Test Pines Golf Club',
    course_name: 'Championship',
    location: { city: 'Testville', state: 'BC', country: 'Canada' },
    tees: {
      male: [
        tee('Black', PARS_A, SI_A, YDS_A, 1.05, 74.6, 141),
        tee('Blue', PARS_A, SI_A, YDS_A, 1.0, 72.9, 136),
        tee('White', PARS_A, SI_A, YDS_A, 0.92, 70.8, 129),
      ],
      female: [tee('Red', PARS_A, SI_A, YDS_A, 0.8, 72.4, 127)],
    },
  },
  {
    id: 'test0002',
    club_name: 'Sample Links',
    course_name: 'Sample Links',
    location: { city: 'Exampleton', state: 'WA', country: 'United States' },
    tees: {
      male: [tee('Gold', PARS_B, SI_B, YDS_B, 1.0, 71.2, 128), tee('Silver', PARS_B, SI_B, YDS_B, 0.9, 69.4, 121)],
      female: [tee('Copper', PARS_B, SI_B, YDS_B, 0.78, 70.1, 120)],
    },
  },
];
