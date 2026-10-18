import * as d3 from "d3";

// Chart dimensions
const width = 760;
const height = 480;
const margin = { top: 30, right: 20, bottom: 40, left: 50 };
const barPadding = 1;

const fmt = d3.format(",");

let data = [];
let svg, gGrid, gBars, gStats, gLabels, gX, gY, counter, legendEl;
let mean, median;

// Scales
const xScale = d3.scaleLinear().range([margin.left, width - margin.right]);
const yScale = d3.scaleLinear().range([height - margin.bottom, margin.top]);

// Axes
const xAxis = (g) => g
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(width / 80).tickFormat(fmt).tickSizeOuter(0));

const yAxis = (g) => g
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale).ticks(height / 40))
    .call((g) => g.select(".domain").remove());

// Grid
const yGrid = (g) => g
    .selectAll("line")
    .data(yScale.ticks(height / 40))
    .join("line")
    .attr("class", "grid-line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", (d) => yScale(d))
    .attr("y2", (d) => yScale(d));

export function initChart({ container, legend, rows }) {
    data = rows;
    legendEl = legend;
    mean = d3.mean(data, (d) => d.births);
    median = d3.median(data, (d) => d.births);

    // Fixed x domain, so the axis stays put when the bin count changes.
    xScale.domain(d3.extent(data, (d) => d.births)).nice();

    svg = d3.select(container).append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; display: block;");

    gGrid = svg.append("g");
    gBars = svg.append("g");
    gStats = svg.append("g");
    gLabels = svg.append("g");
    gX = svg.append("g");
    gY = svg.append("g");

    counter = svg.append("text")
        .attr("class", "counter")
        .attr("x", margin.left + 12)
        .attr("y", margin.top + 20)
        .text("Hover over a bar");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width - margin.right)
        .attr("y", height - 4)
        .attr("text-anchor", "end")
        .text("Births per day →");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", 4)
        .attr("y", 14)
        .text("↑ Days with this many births");
}

export function render({ bins: binCount, split, stats, highlight }) {
    // Set up bins
    const bins = d3.bin()
        .value((d) => d.births)
        .domain(xScale.domain())
        .thresholds(xScale.ticks(binCount))
        (data);

    for (const b of bins) {
        b.weekend = b.filter((d) => d.weekend).length;
        b.weekday = b.length - b.weekend;
    }

    yScale.domain([0, d3.max(bins, (b) => b.length)]).nice();

    gGrid.call(yGrid);
    gX.call(xAxis);
    gY.call(yAxis);

    // One bar per bin, or two stacked bars when split.
    const segments = bins.flatMap((b, i) => split
        ? [{ b, i, key: "weekday", y0: 0, y1: b.weekday },
            { b, i, key: "weekend", y0: b.weekday, y1: b.length }]
        : [{ b, i, key: "all", y0: 0, y1: b.length }]);

    const barX = (d) => xScale(d.b.x0) + barPadding;
    const barW = (d) => Math.max(0, xScale(d.b.x1) - xScale(d.b.x0) - barPadding);
    const gap = (d) => (d.y0 > 0 ? 2 : 0);

    gBars.selectAll("rect")
        .data(segments, (d) => `${binCount}-${d.i}-${d.key}`)
        .join(
            (enter) => enter.append("rect")
                .attr("x", barX).attr("width", barW)
                .attr("y", yScale(0)).attr("height", 0),
            (update) => update,
            (exit) => exit.remove()
        )
        .attr("class", (d) => `bar bar-${d.key}`)
        .classed("is-dim", (d) => highlight && !(d.key === "weekday" && d.b.x1 <= 9500))
        .on("mouseover", (event, d) => onMouseOver(d.b, split))
        .on("mouseout", onMouseOut)
        .transition().duration(600)
        .attr("x", barX)
        .attr("width", barW)
        .attr("y", (d) => yScale(d.y1))
        .attr("height", (d) => Math.max(0, yScale(d.y0) - yScale(d.y1) - gap(d)));

    // Mean and median lines. Mean label sits left of its line, median label right.
    const statLines = stats ? [
        { key: "mean", value: mean, label: `Mean: ${fmt(Math.round(mean))}`, anchor: "end", dx: -6 },
        { key: "median", value: median, label: `Median: ${fmt(median)}`, anchor: "start", dx: 6 }
    ] : [];

    gStats.selectAll("g")
        .data(statLines, (d) => d.key)
        .join((enter) => {
            const g = enter.append("g");
            g.append("line");
            g.append("text");
            return g;
        })
        .attr("class", (d) => `stat stat-${d.key}`)
        .attr("transform", (d) => `translate(${xScale(d.value)},0)`)
        .call((g) => g.select("line")
            .attr("y1", margin.top - 4)
            .attr("y2", height - margin.bottom))
        .call((g) => g.select("text")
            .attr("x", (d) => d.dx)
            .attr("y", margin.top - 8)
            .attr("text-anchor", (d) => d.anchor)
            .text((d) => d.label));

    // Labels above each peak when split.
    const groups = split ? [
        { key: "weekend", text: "Weekends" },
        { key: "weekday", text: "Weekdays" }
    ] : [];

    gLabels.selectAll("text")
        .data(groups, (g) => g.key)
        .join("text")
        .attr("class", "direct-label")
        .attr("text-anchor", "middle")
        .attr("x", (g) => xScale(d3.mean(data.filter((d) => d.weekend === (g.key === "weekend")), (d) => d.births)))
        .attr("y", (g) => yScale(d3.max(bins.filter((b) => b[g.key] > b.length / 2), (b) => b.length)) - 10)
        .text((g) => g.text);

    legendEl.innerHTML = split
        ? `<span><i class="sw-weekday"></i>Weekdays</span><span><i class="sw-weekend"></i>Weekends</span>`
        : "";
}

// Separate event functions, like in the Observable example.
function onMouseOver(bin, split) {
    gBars.selectAll("rect").classed("is-hover", (d) => d.b === bin);
    counter.text(split
        ? `Days: ${fmt(bin.length)} (${fmt(bin.weekday)} weekdays, ${fmt(bin.weekend)} weekends)`
        : `Days: ${fmt(bin.length)}`);
}

function onMouseOut() {
    gBars.selectAll("rect").classed("is-hover", false);
    counter.text("Hover over a bar");
}