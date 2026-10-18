import * as d3 from "d3";
import scrollama from "scrollama";
import { initChart, render } from "./histogram.js";
import cdcUrl from "./data/US_births_1994-2003_CDC_NCHS.csv?url";
import ssaUrl from "./data/US_births_2000-2014_SSA.csv?url";

// One chart state per text step, in the same order as the .step divs.
const states = [
    { bins: 3,   split: false, stats: false },  // 1: what a histogram is, few bins
    { bins: 200, split: false, stats: false },  // 2: too many bins
    { bins: 30,  split: false, stats: false },  // 3: good bin size, two peaks
    { bins: 30,  split: false, stats: true },   // 4: mean and median
    { bins: 80,  split: true,  stats: false },  // 5: weekdays vs. weekends
    { bins: 80,  split: true,  stats: false, highlight: true },  // 6: holidays
];

const parse = (d) => ({
    year: +d.year,
    births: +d.births,
    weekend: +d.day_of_week >= 6   // 6 = Saturday, 7 = Sunday
});

// Load both files, then take CDC for 1994–2003 and SSA for 2004–2014.
const [cdc, ssa] = await Promise.all([
    d3.csv(cdcUrl, parse),
    d3.csv(ssaUrl, parse)
]);

const rows = [
    ...cdc.filter((d) => d.year <= 2003),
    ...ssa.filter((d) => d.year >= 2004)
];

initChart({
    container: document.getElementById("chart"),
    legend: document.getElementById("legend"),
    rows
});
render(states[0]);

const steps = document.querySelectorAll(".step");

scrollama()
    .setup({ step: ".step", offset: 0.6 })
    .onStepEnter(({ index }) => {
        steps.forEach((el, i) => el.classList.toggle("is-active", i === index));
        render(states[index]);
    });