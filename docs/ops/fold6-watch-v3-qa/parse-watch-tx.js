const fs = require("fs");
const path = process.argv[2];
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
const marks = [];
for (const line of lines) {
  const i = line.indexOf("WATCH_TX ");
  if (i < 0) continue;
  const json = line.slice(i + "WATCH_TX ".length).trim();
  try {
    marks.push(JSON.parse(json));
  } catch {
    // skip
  }
}
const firstFrames = marks.filter((m) => m.phase === "first_frame");
const gaps = [];
for (let i = 1; i < firstFrames.length; i++) {
  gaps.push(firstFrames[i].t - firstFrames[i - 1].t);
}
const attachToFrame = [];
let pendingAttach = null;
for (const m of marks) {
  if (m.phase === "surface_attached") pendingAttach = m.t;
  if (m.phase === "first_frame" && pendingAttach != null) {
    attachToFrame.push(m.t - pendingAttach);
    pendingAttach = null;
  }
}
const nextReadyAfterFrame = [];
for (let i = 0; i < marks.length; i++) {
  if (marks[i].phase !== "first_frame") continue;
  for (let j = i + 1; j < Math.min(i + 6, marks.length); j++) {
    if (marks[j].phase === "next_ready") {
      nextReadyAfterFrame.push(marks[j].t - marks[i].t);
      break;
    }
  }
}
const phases = marks.reduce((acc, m) => {
  acc[m.phase] = (acc[m.phase] || 0) + 1;
  return acc;
}, {});
const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
console.log(
  JSON.stringify(
    {
      markCount: marks.length,
      phases,
      firstFrameCount: firstFrames.length,
      firstFrameGapMedianMs: median(gaps),
      firstFrameGapMinMs: gaps.length ? Math.min(...gaps) : null,
      attachToFirstFrameMedianMs: median(attachToFrame),
      attachToFirstFrameMaxMs: attachToFrame.length ? Math.max(...attachToFrame) : null,
      nextReadyAfterFrameMedianMs: median(nextReadyAfterFrame),
      nextReadyAfterFrameCount: nextReadyAfterFrame.length,
      currentEndCount: phases.current_end || 0,
      nextSourceActivationCount: phases.next_source_activation || 0,
    },
    null,
    2
  )
);
