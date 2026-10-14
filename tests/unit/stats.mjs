// Statistiques d'équilibrage : node tests/unit/stats.mjs
import { Simulation } from '../../src/sim/simulation.js';
import { makeBot, runNight } from './bot.js';
for (const night of [1, 2, 3, 4, 5, 6]) {
  const res = []; let wins = 0; const killers = {};
  for (let seed = 1; seed <= 40; seed++) {
    const sim = new Simulation({ night, seed });
    runNight(sim, makeBot(sim));
    if (sim.outcome === 'win') { wins++; res.push(sim.office.power); } else killers[sim.killer] = (killers[sim.killer] ?? 0) + 1;
  }
  const avg = res.reduce((a, b) => a + b, 0) / Math.max(1, res.length);
  console.log(`Nuit ${night}: robot gagne ${wins}/40, énergie finale moy. ${avg.toFixed(1)}%, min ${Math.min(...res).toFixed(1)}%, morts ${JSON.stringify(killers)}`);
}
