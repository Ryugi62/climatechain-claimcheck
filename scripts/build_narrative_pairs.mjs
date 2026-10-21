// Builds data/narrative/pairs.json: labelled (record text, narrative) pairs. Hypotheses are hand-written (certs) or templated (Gold Standard rows),
// frozen BEFORE any model run (SPEC pre-registration S9). Re-running must give the same file.
import { readFileSync, writeFileSync } from 'node:fs';
import { maskSerials as stripSerials } from '../src/domain/serial.mjs';
import { recordText } from '../src/domain/narrative.mjs';
const J = (f) => JSON.parse(readFileSync(f, 'utf8'));
const certs = [...J('data/real/samples.json'), ...J('data/real/heldout.json')];
// id: [matching narrative, changed narrative, kind of change]
const H = {
 'dolomiti-00': ['In March 2024 Dolomiti Energia retired 1,000 carbon credits from the Cordillera Azul National Park REDD Project.', 'In March 2024 Dolomiti Energia retired 1,000 carbon credits from a wind power project.', 'project_type'],
 'dolomiti-03': ['Dolomiti Energia retired 4,890 Verified Carbon Units from the Cordillera Azul National Park REDD Project.', 'Dolomiti Energia retired 4,890 Verified Carbon Units in 2019 from the Cordillera Azul National Park REDD Project.', 'year'],
 'dolomiti-06': ['Our company retired 466 VCUs on 29 March 2024 for the Cordillera Azul National Park REDD Project.', 'Our company retired 4,660 VCUs on 29 March 2024 for the Cordillera Azul National Park REDD Project.', 'quantity'],
 'dolomiti-12': ['174 Verified Carbon Units from the Cordillera Azul National Park REDD Project were retired on behalf of Dolomiti Energia.', '174 Verified Carbon Units from a hydroelectric dam project in Norway were retired on behalf of Dolomiti Energia.', 'country'],
 'dolomiti-28': ['We retired 27,020 credits from the 210 MW Musi Hydro Power Plant in Bengkulu.', 'We retired 27,020 credits from a forest protection project in Brazil.', 'project_type'],
 'dolomiti-30': ['Dolomiti Energia retired 2,189 Verified Carbon Units from the Rio Anapu-Pacaja REDD Project.', 'Dolomiti Energia retired 2,189 Verified Carbon Units from a cookstove distribution project.', 'project_type'],
 'dolomiti-32': ['We retired 3,776 VCUs from a tropical forest conservation project in Acre, Brazil.', 'We retired 3,776 VCUs from a solar farm in Spain.', 'country'],
 'dolomiti-38': ['Dolomiti Energia retired 8,000 Verified Carbon Units on 29 March 2024 from The Mai Ndombe REDD+ Project.', 'Dolomiti Energia retired 8,000 Verified Carbon Units on 29 March 2020 from The Mai Ndombe REDD+ Project.', 'year'],
 'dolomiti-39': ['We retired 7,000 credits from the REDD+ Project Resguardo Indigena Unificado Selva de Mataven.', 'We retired 7,000 credits from a landfill gas project in Turkey.', 'country'],
 'dolomiti-41': ['We retired 35,000 Verified Carbon Units from a hydroelectric project in Kinnaur District, Himachal Pradesh.', 'We retired 35,000 Verified Carbon Units from a rainforest conservation project in Peru.', 'project_type'],
 'dolomiti-45': ['In July 2024 we retired 11,326 Verified Carbon Units from a renewable wind power project.', 'In July 2024 we retired 11,326 Verified Carbon Units from a household water filter project.', 'project_type'],
 'storebrand-2021': ['Storebrand ASA retired 475 Verified Carbon Units in March 2021.', 'Storebrand ASA retired 475 Verified Carbon Units in March 2018.', 'year'],
 'storebrand-2022': ['Storebrand retired 320 VCUs on 30 March 2022 under the Verra Registry.', 'Storebrand retired 320 VCUs on 30 March 2022 under the Gold Standard registry.', 'registry'],
 'storebrand-2023': ['On 28 April 2023 Storebrand ASA retired 685 Verified Carbon Units.', 'On 28 April 2023 Storebrand ASA retired 6,850 Verified Carbon Units.', 'quantity'],
 'commerzbank-2025': ['Commerzbank AG retired 3,544 Verified Carbon Units in December 2025 as its CO2 compensation for 2025.', 'Commerzbank AG retired 3,544 Verified Carbon Units in December 2022 as its CO2 compensation for 2022.', 'year'],
 'easyjet-kamuthi-2022': ['easyJet retired 56 Verified Carbon Units on 3 May 2022.', 'Lufthansa retired 56 Verified Carbon Units on 3 May 2022.', 'company'],
 'aixtron-2024': ['AIXTRON SE retired 5,326 Verified Carbon Units in March 2024 for its 2023 climate contribution.', 'AIXTRON SE retired 5,326 Verified Carbon Units in March 2021 for its 2020 climate contribution.', 'year'],
 'southampton-gs-2025': ['Southampton International Airport retired 338 tCO2e in August 2025 through the Bursa-Hamitler Landfill Gas Collection and Energy Utilization Project.', 'Southampton International Airport retired 338 tCO2e in August 2025 through a rice-husk biomass project in Cambodia.', 'project_type'],
 'easyjet-madre-p0': ['easyJet retired 804,199 tCO2e of vintage 2017 credits from the Madre de Dios Amazon REDD Project.', 'easyJet retired 804,199 tCO2e of vintage 2012 credits from the Madre de Dios Amazon REDD Project.', 'year'],
 'easyjet-madre-p2': ['easyJet offset 804,199 tCO2e through the Madre de Dios Amazon REDD Project in Peru.', 'easyJet offset 804,199 tCO2e through a wind farm in Kenya.', 'country'],
 'easyjet-madre-p3': ['easyJet offset 327,947 tCO2e of aviation emissions for the first quarter of 2020 through the Madre de Dios Amazon REDD Project.', 'easyJet offset 327,947 tCO2e of aviation emissions for the first quarter of 2017 through the Madre de Dios Amazon REDD Project.', 'year'],
 'easyjet-madre-p4': ['On 9 June 2020 easyJet retired 80,131 Verified Carbon Units from the Madre de Dios Amazon REDD Project.', 'On 9 June 2020 easyJet retired 80,131 Verified Carbon Units from a cement kiln waste-heat project in China.', 'project_type'],
 'easyjet-madre-p5': ['easyJet retired 115,670 VCUs in June 2020 from the Madre de Dios Amazon REDD Project.', 'easyJet retired 115,670 VCUs in June 2020 from a solar power project in India.', 'project_type'],
 'easyjet-madre-p6': ['On 9 June 2020 easyJet retired 132,146 Verified Carbon Units.', 'On 9 June 2020 Lufthansa retired 132,146 Verified Carbon Units.', 'company'],
};
const pairs = [];
for (const c of certs) {
  const h = H[c.id]; if (!h) throw new Error('no hypotheses for ' + c.id);
  const premise = stripSerials(c.text).replace(/\s+/g, ' ').trim();
  pairs.push({ id: c.id + ':match', source: 'real_certificate', premise, hypothesis: h[0], label: 'match', change: null });
  pairs.push({ id: c.id + ':changed', source: 'real_certificate', premise, hypothesis: h[1], label: 'changed', change: h[2] });
}
// Gold Standard rows: first 12 distinct projects (sorted by id) among RETIRED rows, change kind rotates.
const rows = J('data/gs/credits-sample.json').filter((r) => r.status === 'RETIRED').sort((a, b) => String(a.id).localeCompare(String(b.id)));
const seen = new Set(); const pick = [];
for (const r of rows) { if (!seen.has(r.project_name)) { seen.add(r.project_name); pick.push(r); } if (pick.length === 12) break; }
const OTHER = { country: ['Norway', 'Chile', 'Vietnam'], type: ['a wind farm', 'a rainforest conservation project', 'a landfill gas project'] };
const cn = new Intl.DisplayNames(['en'], { type: 'region' });
pick.forEach((r, i) => {
  const country = cn.of(r.country_code), n = r.number_of_credits.toLocaleString('en-US'), y = Number(r.vintage);
  const premise = recordText(r);
  const mt = [`We retired ${n} Gold Standard credits from the project ${r.project_name} in ${country}.`, `In our report: ${n} credits of vintage ${y} from ${r.project_name}, retired.`, `The retired credits come from the ${r.project_name}, located in ${country}.`][i % 3];
  const k = ['country', 'year', 'project_type'][i % 3];
  const ch = k === 'country' ? `We retired ${n} Gold Standard credits from the project ${r.project_name} in ${OTHER.country[i % 3] === country ? 'Chile' : OTHER.country[i % 3]}.`
    : k === 'year' ? `In our report: ${n} credits of vintage ${y - 6} from ${r.project_name}, retired.`
    : `The retired credits come from ${OTHER.type[i % 3]} in ${country}.`;
  pairs.push({ id: 'gs-' + r.id + ':match', source: 'gold_standard_row', premise, hypothesis: mt, label: 'match', change: null });
  pairs.push({ id: 'gs-' + r.id + ':changed', source: 'gold_standard_row', premise, hypothesis: ch, label: 'changed', change: k });
});
writeFileSync('data/narrative/pairs.json', JSON.stringify({ frozen: '2026-10-21 before any model run', pairs }, null, 1) + '\n');
console.log(pairs.length, 'pairs');
