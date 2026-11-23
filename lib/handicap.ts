// Flat handicap-index stroke allocation (no course rating/slope): the classic
// "extra stroke on your hardest N holes" pattern, with a second pass for
// handicaps over 18.
export function strokesReceivedOnHole(handicapIndex: number, strokeIndex: number): number {
  const rounded = Math.round(handicapIndex);
  if (rounded <= 0) return 0;
  const base = Math.floor(rounded / 18);
  const extra = rounded % 18 >= strokeIndex ? 1 : 0;
  return base + extra;
}

function selfCheck() {
  // 9-handicap: strokes on the 9 hardest holes (strokeIndex 1-9) only.
  console.assert(strokesReceivedOnHole(9, 1) === 1, 'handicap: hardest hole should get a stroke');
  console.assert(strokesReceivedOnHole(9, 9) === 1, 'handicap: 9th hardest should get a stroke');
  console.assert(strokesReceivedOnHole(9, 10) === 0, 'handicap: easier than 9th should get none');
  // 22-handicap: every hole gets at least 1, plus the 4 hardest get a 2nd.
  console.assert(strokesReceivedOnHole(22, 1) === 2, 'handicap: 22 should give 2 on hardest holes');
  console.assert(strokesReceivedOnHole(22, 18) === 1, 'handicap: 22 should give 1 on easiest hole');
  console.assert(strokesReceivedOnHole(0, 5) === 0, 'handicap: scratch golfer gets nothing');
}
selfCheck();
