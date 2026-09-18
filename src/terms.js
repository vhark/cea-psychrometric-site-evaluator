/* Plain-language definitions for the terms, units and metrics the interface puts on screen.
 *
 * The rule for writing an entry: explain it to someone who runs a growing operation and has never
 * read a psychrometric chart. Say what the thing is, what its unit means in ordinary terms, and what
 * a reader should do with it. Precision belongs in docs/GLOSSARY.md, which gives the same terms with
 * the exact function that computes them; this file is the doorway, not the reference.
 *
 * Keys match scenario field keys wherever one exists, so fieldControl can look a term up directly.
 * Everything else is a slug placed with data-term in index.html or by the code that renders it.
 */

export const TERMS = {

  /* Units and shared ideas */
  celsius: {
    term: 'Degrees Celsius (°C)',
    plain: 'The temperature scale this tool works in. Water freezes at 0 °C and boils at 100 °C. Room temperature is about 21 °C.',
    unit: 'To convert to Fahrenheit, multiply by 1.8 and add 32. So 24 °C is 75 °F.',
    why: 'A difference of 1 °C is a difference of 1.8 °F, which matters when you read a tolerance.',
  },
  fraction: {
    term: 'Fraction',
    plain: 'A share of the whole, written as a number between 0 and 1 instead of a percentage.',
    unit: '0.65 means 65 percent. 1 means all of it, and 0 means none of it.',
    why: 'The tool uses fractions so that several of them can be multiplied together without juggling percent signs.',
  },
  percentagePoints: {
    term: 'Percentage points (pp)',
    plain: 'The plain difference between two percentages, subtracted one from the other.',
    unit: 'Going from 27 percent to 73 percent is a rise of 46 percentage points.',
    why: 'That same change could be advertised as a 170 percent improvement, which sounds larger and says less. This tool always reports the difference in points and shows you both ends.',
    glossary: 'Operating cost, capital and percentage points',
  },
  ach: {
    term: 'Air changes per hour (ACH)',
    plain: 'How many times in an hour a volume of air equal to the whole room is swapped for outside air.',
    unit: '1 ACH means the room volume is replaced once an hour. In a 1,000 m³ room that is 1,000 m³ an hour.',
    why: 'Outside air is how moisture and heat get in and out of the building. It is the single number that most often decides whether the equipment can hold the band.',
    glossary: 'Outdoor air and ACH',
  },
  kilowatt: {
    term: 'Kilowatt (kW)',
    plain: 'A rate of energy use or delivery, not an amount. It is how fast something is working right now.',
    unit: '1 kW for 1 hour uses 1 kilowatt hour (kWh) of energy. A 3.5 kW heater running for two hours uses 7 kWh.',
    why: 'Capacity is quoted in kW. Your bill is in kWh. The tool tracks both and never mixes them up.',
  },
  kwh: {
    term: 'Kilowatt hour (kWh)',
    plain: 'The amount of energy used, and the unit your electricity bill is priced in.',
    unit: 'One 100 W light left on for ten hours uses 1 kWh.',
    why: 'Every cost this tool reports is the kWh it simulated multiplied by the price you entered. Change the price and the cost changes.',
  },

  /* The target band */
  jointTargetBand: {
    term: 'Joint target band',
    plain: 'The set of indoor conditions you are calling acceptable. Temperature near its target, humidity inside its window, and the air not so damp that it reaches the dew-point ceiling.',
    unit: 'Made of its parts: °C for temperature and dew point, kPa for VPD.',
    why: 'The word "joint" is doing real work. All of the limits have to pass in the same hour. An hour that is the right temperature but too damp does not count.',
    glossary: 'Joint target band',
  },
  attainment: {
    term: 'Attainment',
    plain: 'The share of comparable hours when the room actually held every part of your target band at once.',
    unit: 'A percentage of the hours that were eligible to be counted, not of the whole year.',
    why: 'This is the headline number. Read it beside "Usable hours of weather", which tells you how much of the expected record actually arrived. A high score on half a year is not the same claim.',
    glossary: 'Attainment',
  },
  eligibleHour: {
    term: 'Eligible hour',
    plain: 'An hour that is allowed to count in a comparison. The weather for it arrived, the simulation produced a sensible answer, and it was not a warm-up hour.',
    unit: 'A count of hours.',
    why: 'When two strategies are compared they are scored over exactly the same hours, so neither gets credit for an hour the other never saw. That is why a comparison total can differ a little from one scenario run on its own.',
    glossary: 'Eligible hour',
  },
  warmupHour: {
    term: 'Warm-up hour',
    plain: 'The first hour after the simulation starts or after a gap in the weather, while the room is still settling from its assumed starting condition.',
    unit: 'One hour per continuous stretch of weather.',
    why: 'Its energy and water still count, because that energy really would be spent. Its comfort result does not count, because it says more about the starting guess than about the equipment.',
    glossary: 'Warm-up hour',
  },
  vpdMin: {
    term: 'VPD, vapour pressure deficit',
    plain: 'How much more moisture the air could hold before it is full. It is the honest measure of how hard the air is pulling water out of your plants.',
    unit: 'Measured in kPa. Most leafy crops sit somewhere around 0.5 to 1.2 kPa. Low means damp and still, high means dry and thirsty.',
    why: 'Relative humidity alone will mislead you, because the same RH means very different drying power at different temperatures. VPD does not have that problem.',
    glossary: 'VPD (vapour pressure deficit)',
  },
  maxDewPointC: {
    term: 'Dew-point ceiling',
    plain: 'The temperature at which the air is so full of moisture that water starts condensing on surfaces. The ceiling is the highest dew point you are willing to allow.',
    unit: 'In °C. If the dew point reaches 19 °C, then any surface colder than 19 °C gets wet.',
    why: 'This is the disease and drip line. Glass, metal and cold walls are usually the first things to go wet, and they go wet before the room average looks like it is in trouble.',
    glossary: 'Dew-point ceiling',
  },
  wetBulb: {
    term: 'Wet-bulb temperature',
    plain: 'The coldest temperature you could reach by evaporating water into the air, and nothing more.',
    unit: 'In °C, always at or below the air temperature. The drier the air, the bigger the gap.',
    why: 'It is the hard floor on evaporative cooling. A pad cannot cool below the wet bulb no matter how good it is, which is why pads work in dry heat and disappoint in humid heat.',
    glossary: 'Wet-bulb temperature',
  },

  /* Light */
  dliTarget: {
    term: 'DLI, daily light integral',
    plain: 'The total amount of usable light the crop receives over a whole day, added up rather than measured at one moment.',
    unit: 'In mol/m²/day. Leafy greens often want somewhere near 12 to 17. A bright summer day outdoors is over 40; a dark December day in the far north can be under 1.',
    why: 'Plants respond to the daily total, not the peak. A long dim day and a short bright day can deliver the same DLI.',
    glossary: 'DLI (daily light integral)',
  },
  photoperiod: {
    term: 'Photoperiod',
    plain: 'How many hours a day the lights are scheduled on, and what the crop reads as daytime.',
    unit: 'Hours per day, with a start hour on the local clock.',
    why: 'This is also what tells the tool which target to hold, the day one or the night one. The local clock matters, which is why the time zone has to be right.',
  },
  efficacy: {
    term: 'Photon efficacy',
    plain: 'How much usable plant light a fixture makes from the electricity it draws.',
    unit: 'In µmol/J. Modern LEDs are roughly 2.5 to 3.5. Older HPS lamps are nearer 1.7.',
    why: 'A higher number means more light and less waste heat for the same power bill. The waste heat still has to be removed, so lighting choice changes your cooling load too.',
  },
  lai: {
    term: 'LAI, leaf area index',
    plain: 'How much leaf you have, counted as square metres of leaf over each square metre of floor beneath it.',
    unit: 'LAI 3 means three square metres of leaf above every square metre of growing area.',
    why: 'More leaf means more water released into the air. It is one of the largest single influences on how much moisture the equipment has to remove.',
  },

  /* Envelope */
  uValue: {
    term: 'U-value',
    plain: 'How readily heat leaks through the building skin. Higher means leakier.',
    unit: 'In W/m²K, the watts lost through each square metre for every degree of difference between inside and outside. Single-layer glass is around 5.8; a double poly skin is nearer 4; an insulated wall can be under 0.5.',
    why: 'This is the number that decides your winter heating bill, and it also caps how cold you can hold the room in summer.',
  },
  thermalMassKJm2K: {
    term: 'Thermal mass',
    plain: 'How much heat the floor, benches, water and structure soak up and give back, which slows down how fast the room temperature moves.',
    unit: 'In kJ/m²K, the energy stored per square metre for each degree of temperature change.',
    why: 'High mass smooths out short swings and makes the room forgiving. Low mass means the room follows the weather almost immediately.',
  },
  infiltrationACH: {
    term: 'Uncontrolled infiltration',
    plain: 'Air that leaks in and out through gaps you did not design, around doors, vents and seams.',
    unit: 'In air changes per hour. See ACH.',
    why: 'You cannot switch this off, so it sets a floor on your heating and dehumidification load. It is separate from the outside air you deliberately bring in.',
  },
  envelopeRatio: {
    term: 'Envelope to floor ratio',
    plain: 'How much building skin you have for each square metre of floor.',
    unit: 'A multiplier. A stand-alone gabled house is around 1.7. Bays joined together share walls and come out lower.',
    why: 'Two buildings with the same floor area and the same glass can have very different heat losses if one has far more exposed surface.',
  },
  solarTransmission: {
    term: 'Solar transmission',
    plain: 'The share of the sun\'s heat that makes it through the covering and into the room.',
    unit: 'A fraction. 0.7 means 70 percent gets in.',
    why: 'Free heat in winter and an unwanted load in summer. It is listed separately from crop light transmission because glazing treats heat and plant light differently.',
  },

  /* Airflow and equipment */
  minVentACH: {
    term: 'Minimum controlled outdoor air',
    plain: 'The least amount of outside air you will bring in on purpose, whatever the weather is doing.',
    unit: 'In air changes per hour. See ACH.',
    why: 'Usually set by the crop or by CO₂ and staff requirements rather than by climate. Setting it higher than you need is expensive in every hour of the year.',
  },
  maxVentACH: {
    term: 'Maximum controlled outdoor-air capacity',
    plain: 'The most outside air the fans and vents can bring in when the weather is worth using.',
    unit: 'In air changes per hour. See ACH.',
    why: 'This is your ceiling on free cooling and free drying. When outside air is better than inside air, this number decides how much of that advantage you can actually take.',
  },
  fanWPerM3s: {
    term: 'Fan specific power',
    plain: 'The electricity the fans draw for each unit of air they move.',
    unit: 'In W per m³/s. Around 180 is an ordinary figure for a well-behaved system.',
    why: 'Moving air is never free. A high figure can quietly cancel out the saving from using outside air instead of a machine.',
  },
  padEffectiveness: {
    term: 'Pad effectiveness',
    plain: 'How much of the theoretical evaporative cooling a wet pad actually delivers.',
    unit: 'A fraction. 0.85 means the pad closes 85 percent of the gap between the incoming air temperature and its wet-bulb temperature.',
    why: 'It can never reach 1, and it can never cool below the wet bulb. In humid weather the wet bulb is already high, so even a perfect pad has almost nothing to work with.',
    glossary: 'Pad effectiveness',
  },
  coolingCOP: {
    term: 'COP, coefficient of performance',
    plain: 'How much cooling or heating you get out for each unit of electricity you put in.',
    unit: 'A ratio. COP 3 means 3 kW of cooling for every 1 kW of electricity drawn.',
    why: 'This is the single biggest lever on running cost for mechanical cooling. Real equipment does worse on hot days than its rating sheet suggests.',
  },
  coolingSHR: {
    term: 'SHR, sensible heat ratio',
    plain: 'How a cooling coil splits its work between lowering the temperature and wringing out moisture.',
    unit: 'A fraction. SHR 0.75 means three quarters of the coil\'s effort goes to temperature and one quarter to removing water.',
    why: 'A coil with a high SHR will hit your temperature target and leave the room damp. If moisture is your binding problem, SHR matters more than raw capacity.',
    glossary: 'SHR (sensible heat ratio)',
  },
  dehuLPerKWh: {
    term: 'Dehumidifier efficiency',
    plain: 'How many litres of water a dehumidifier pulls out of the air for each kWh of electricity it uses.',
    unit: 'In L/kWh. Around 2 to 3 is typical for condensing units at growing-room conditions.',
    why: 'Rating-plate figures are usually measured in warmer, wetter air than your room, so real performance is often lower.',
  },
  dehuHeatFraction: {
    term: 'Dehumidifier heat returned to the room',
    plain: 'A dehumidifier does not destroy heat. It gives back everything it drew, plus the heat released when the water it removed turned back into liquid.',
    unit: 'A fraction of that heat that lands back inside the room rather than being ducted away.',
    why: 'This is why drying the air often makes the room hotter, and why dehumidification and cooling have to be looked at together rather than one at a time.',
    glossary: 'Dehumidifier heat returned to the zone',
  },
  heaterEfficiency: {
    term: 'Heater efficiency',
    plain: 'How much of the fuel you buy turns into heat that actually reaches the room.',
    unit: 'A fraction. 0.85 means 85 percent arrives and 15 percent goes up the flue or into the wall.',
    why: 'The tool prices the fuel you purchase, not the heat delivered, so this number sits directly in your heating bill.',
  },
  doasM3s: {
    term: 'DOAS, dedicated outdoor air system',
    plain: 'A unit that conditions incoming outside air on its own, before that air reaches the room, instead of asking the room equipment to deal with it afterwards.',
    unit: 'Its capacity is given in m³/s, the volume of air it can treat each second.',
    why: 'It handles the outside-air load separately, which usually gives tighter humidity control. It is a treatment stage on the air you already bring in, not an extra supply of air.',
    glossary: 'HRV, ERV and DOAS',
  },
  heatRecovery: {
    term: 'HRV and ERV heat recovery',
    plain: 'A device that lets the air you are throwing out pre-condition the fresh air coming in, without the two streams mixing.',
    unit: 'Rated as the fraction of the difference it recovers, usually 0.5 to 0.8.',
    why: 'An HRV moves heat only. An ERV moves heat and some moisture, which can help or hurt depending on whether your problem is a damp room or a dry one.',
    glossary: 'HRV, ERV and DOAS',
  },

  /* Fields whose own meaning matters more than their unit's */
  dayTargetC: {
    term: 'Day and night targets',
    plain: 'The air temperature you are aiming to hold while the lights are on, and the separate one you aim for at night.',
    unit: 'In °C. Many leafy crops run a few degrees cooler at night than by day.',
    why: 'Which one applies is decided by the photoperiod on the local clock, so the site time zone has to be right for these to mean anything.',
  },
  tempToleranceC: {
    term: 'Temperature tolerance',
    plain: 'How far the room is allowed to drift from the target before the hour stops counting as on target.',
    unit: 'In °C either side. A tolerance of 2 around a 22 °C target accepts 20 to 24 °C.',
    why: 'This is the single easiest number to move your score with, so change it deliberately. A wide tolerance does not make the equipment better, it makes the test easier.',
  },
  coolingMinOutdoorC: {
    term: 'DX outdoor temperature limits',
    plain: 'The outdoor conditions between which a direct-expansion cooling unit will actually run.',
    unit: 'In °C, a low cutoff and a high one.',
    why: 'Below the low limit the unit is locked out and something else has to carry the load. Above the high limit its capacity falls off. Equipment does not work everywhere on its rating sheet.',
  },
  doasSupplyDewPointC: {
    term: 'DOAS supply dew point',
    plain: 'How dry the outdoor air unit delivers its air, stated as the dew point of what leaves it.',
    unit: 'In °C. A lower number is drier air.',
    why: 'This is the target the unit aims at, not a promise. When the heating behind it is too small the tool reports the state actually reached, not the one you asked for.',
  },
  doasSupplyTempC: {
    term: 'DOAS supply temperature',
    plain: 'How warm or cool the outdoor air unit delivers its air, after any drying and any reheat.',
    unit: 'In °C.',
    why: 'Drying air by cooling it leaves it cold. Supplying it cold cools the room whether or not you wanted that, which is why reheat exists and why it costs energy.',
  },
  lightDelivery: {
    term: 'Canopy light delivery',
    plain: 'The share of the light a fixture emits that actually lands on leaves rather than on aisles, walls and floor.',
    unit: 'A fraction. 0.85 means 85 percent reaches the canopy.',
    why: 'Fixture ratings are measured at the fixture. What the crop receives is always less, and the gap is a layout question rather than a product one.',
  },
  parTransmission: {
    term: 'Crop light transmission',
    plain: 'The share of outdoor daylight that gets through the covering and reaches the crop.',
    unit: 'A fraction. It is listed separately from thermal solar transmission because glazing treats plant light and heat differently.',
    why: 'This sets how much of your daily light target the sky can cover for free, and therefore how much the fixtures have to make up.',
  },
  reheatFraction: {
    term: 'Recoverable condenser heat',
    plain: 'The share of the waste heat a cooling unit rejects that you can capture and reuse to warm the air back up after drying it.',
    unit: 'A fraction of the rejected heat.',
    why: 'Reheat you recover is free. Reheat you buy is paid for twice, once to cool the air and again to warm it. This number decides which case you are in.',
  },
  discountRate: {
    term: 'Discount rate',
    plain: 'The rate used to judge money spent later against money spent now, because a dollar in ten years is not a dollar today.',
    unit: 'A fraction per year. 0.06 is 6 percent a year.',
    why: 'It only affects the life-cycle comparison, never the simulated energy or water. Move it and the ranking between a cheap-to-buy and a cheap-to-run option can flip.',
  },
  areaM2: {
    term: 'Floor area and active canopy',
    plain: 'Floor area is the footprint of the space. Active canopy is how much growing surface sits inside it, which on stacked racks can be several times the floor.',
    unit: 'Both in m². One m² is about 10.8 ft².',
    why: 'Loads scale with different ones of these. The building skin follows the floor, while crop moisture follows the canopy, so racks change the balance sharply.',
  },
  heightM: {
    term: 'Mean height',
    plain: 'The average interior height, used with the floor area to get the air volume in the room.',
    unit: 'In m. One m is about 3.3 ft.',
    why: 'Every air change per hour figure is a share of this volume, so a wrong height makes every airflow number wrong by the same proportion.',
  },
  dehuKgH: {
    term: 'Moisture capacity',
    plain: 'How much water a dehumidifier or desiccant can remove from the air in an hour.',
    unit: 'In kg per hour. One kg of water is one litre.',
    why: 'Compare it against what the crop releases. A crop transpiring 3 L/m²/day across 500 m² puts out over 60 kg a day, and it does not arrive evenly.',
  },
  transpirationLDayM2: {
    term: 'Crop evaporation',
    plain: 'How much water the crop releases into the air per square metre of canopy per day.',
    unit: 'In litres per m² per day. Every litre that evaporates has to be removed again by the equipment.',
    why: 'This is the moisture load in its rawest form, and it is usually the number a first design underestimates.',
  },
  installedCost: {
    term: 'Installed cost',
    plain: 'What the equipment costs to buy and put in, as a single figure you enter.',
    unit: 'In dollars.',
    why: 'The defaults here are illustrative placeholders for screening, not quotes. Replace them with real numbers before any of the investment comparison means anything.',
  },
  lifeYears: {
    term: 'Service life',
    plain: 'How many years you expect the equipment to last before it is replaced.',
    unit: 'In years.',
    why: 'It spreads the installed cost across time in the life-cycle view. A cheap unit with a short life can lose to an expensive one that lasts.',
  },

  /* Results and evidence */
  sensibleLatent: {
    term: 'Sensible and latent heat',
    plain: 'Two different jobs your equipment has to do. Sensible heat changes the air temperature and you can feel it on a thermometer. Latent heat changes how much water the air holds and a thermometer will not see it at all.',
    unit: 'Both are measured in kW or kWh. The split between them is the sensible heat ratio.',
    why: 'A crop releasing water is mostly a latent load. Size equipment on temperature alone and it will hit your setpoint while the room stays wet, which is the most common way a build disappoints.',
  },
  co2Window: {
    term: 'CO2 enrichment window',
    plain: 'The hours when the vents are closed enough that added CO2 would stay in the room instead of blowing straight outside.',
    unit: 'A count of hours.',
    why: 'Enrichment pays only when the room is shut. This panel shows when that actually happens in your climate, which is usually far fewer hours than people expect.',
    glossary: 'Enrichment window',
  },
  dominance: {
    term: 'Dominated and non-dominated strategies',
    plain: 'A strategy is dominated when another one beats it on both counts: it holds the target band better and it costs less to run. There is then no case for it on these numbers.',
    unit: 'A ranking, not a score.',
    why: 'What survives is the set where you have a real trade to make, paying more for more hours in band. The tool will not pick for you, because that depends on what an hour is worth to your crop.',
    glossary: 'Dominance and the operating-cost frontier',
  },
  freeCooling: {
    term: 'Free cooling',
    plain: 'Hours when the outside air is simply better than the inside air, so opening up does the work a chiller would otherwise do.',
    unit: 'A count of hours in the record.',
    why: 'This is a weather-side count. It says the opportunity existed, not that your fans were big enough to take it or that the room actually held the band.',
    glossary: 'Free cooling',
  },
  equivalentFullLoadHours: {
    term: 'Equivalent full-load hours',
    plain: 'How long a piece of equipment would have run if it only ever ran flat out, carrying the same total work it actually did across many part-load hours.',
    unit: 'In hours.',
    why: 'It makes "ran gently for a long time" and "ran hard for a short time" comparable. Read it beside actual run hours, not instead of them.',
    glossary: 'Equivalent full-load hours',
  },
  operatingCost: {
    term: 'Operating cost',
    plain: 'The modelled cost of the electricity, heating fuel and water for the period that was simulated, at the prices you entered.',
    unit: 'In dollars, for the simulated period only, never scaled up into a claimed annual figure.',
    why: 'It is not a quote and not a guaranteed saving. It leaves out installation, maintenance, labour, demand charges and time-of-use rates, all of which are listed on the export.',
    glossary: 'Operating cost, capital and percentage points',
  },
  evidenceTier: {
    term: 'Evidence tier',
    plain: 'An honest label for how much weight a number here can carry, from an assumption-based screen up to a model checked against measured buildings.',
    unit: 'A tier, stated on every export.',
    why: 'This tool is a screen. It is built to tell you which strategies are worth engineering, not to size equipment or predict your bill.',
    glossary: 'Evidence tier',
  },
  screening: {
    term: 'Screening, not design',
    plain: 'The whole tool compares strategies under assumptions you can see and edit. It does not size equipment and it is not a substitute for an engineered design.',
    unit: 'Every result carries the model version that produced it.',
    why: 'Use it to decide what deserves a real engineering study. Take the shortlist to an engineer, not the numbers.',
  },
  ziptz: {
    term: 'Why the time zone matters',
    plain: 'The tool builds local days and the day and night schedule from the IANA time zone, not from the coordinates.',
    unit: 'An IANA name such as America/Denver.',
    why: 'Get it wrong and every daily figure, every photoperiod and every day or night target lands on the wrong clock while still looking perfectly reasonable. The public ZIP list has no time zone column, so the tool carries its own ZIP table and still asks you to confirm what it proposes.',
  },
  station: {
    term: 'Observation station',
    plain: 'A real weather station whose recorded observations you can use instead of modelled satellite data.',
    unit: 'A three or four character identifier, such as DEN for Denver International.',
    why: 'A station is a specific place, usually an airport, and it does not move when you change the ZIP. The tool reports how far the station you chose sits from your site so you can judge whether it represents you.',
  },
  gridded: {
    term: 'Gridded weather',
    plain: 'Weather from a model that covers the whole planet in cells, rather than from an instrument at your address.',
    unit: 'NASA POWER cells are roughly 50 km across.',
    why: 'It is complete and consistent, with no missing hours, but it is a cell average. It will not see your valley, your city heat or the hill behind you.',
  },
};

/* One open bubble at a time, positioned under its button and kept on screen. Native popover does the
   light dismiss, the Escape key and the top layer; this only places the box. */
let counter = 0;
export function infoBubble(key, labelText) {
  const entry = TERMS[key];
  if (!entry) return null;
  const id = `term-${++counter}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'info';
  button.textContent = '?';
  button.setAttribute('popovertarget', id);
  button.setAttribute('aria-label', `What does "${labelText || entry.term}" mean?`);

  const bubble = document.createElement('div');
  bubble.id = id;
  bubble.className = 'info-bubble';
  bubble.popover = 'auto';
  const heading = document.createElement('h4');
  heading.textContent = entry.term;
  bubble.append(heading, paragraph(entry.plain));
  if (entry.unit) bubble.append(paragraph(entry.unit, 'bubble-unit'));
  if (entry.why) bubble.append(paragraph(entry.why, 'bubble-why'));
  // A pointer, not a link: the deployment serves GLOSSARY.md as text/markdown, which browsers
  // download rather than render, and a downloaded file ignores the anchor anyway.
  if (entry.glossary) bubble.append(paragraph(`Exactly how this is computed: docs/GLOSSARY.md, "${entry.glossary}".`, 'bubble-link'));

  bubble.addEventListener('beforetoggle', event => {
    if (event.newState !== 'open') return;
    const anchor = button.getBoundingClientRect();
    bubble.style.left = '0px';
    bubble.style.top = '0px';
    const width = Math.min(340, document.documentElement.clientWidth - 32);
    bubble.style.width = `${width}px`;
    const left = Math.max(16, Math.min(anchor.left, document.documentElement.clientWidth - width - 16));
    const below = anchor.bottom + 8;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${below}px`;
    // Flip above the button when there is not room beneath it.
    requestAnimationFrame(() => {
      const box = bubble.getBoundingClientRect();
      if (box.bottom > document.documentElement.clientHeight - 8 && anchor.top > box.height + 16) {
        bubble.style.top = `${anchor.top - box.height - 8}px`;
      }
    });
  });
  return {button, bubble};
}

function paragraph(text, className) {
  const p = document.createElement('p');
  p.textContent = text;
  if (className) p.className = className;
  return p;
}

/** Attach a bubble to every element carrying data-term. Safe to call again on new DOM. */
export function decorateTerms(root = document) {
  for (const host of root.querySelectorAll('[data-term]:not([data-term-done])')) {
    const parts = infoBubble(host.dataset.term, host.textContent.trim());
    if (!parts) continue;
    host.setAttribute('data-term-done', '1');
    host.append(parts.button);
    document.body.append(parts.bubble);
  }
}
