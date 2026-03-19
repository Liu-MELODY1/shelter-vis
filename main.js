/* ──────────────────────────────────────────────────────────────
   Austin Animal Shelter Explorer  ·  main.js
   CSC316 Assignment 3
────────────────────────────────────────────────────────────── */

// ── Constants ────────────────────────────────────────────────
const OUTCOMES = ['Other', 'Euthanasia', 'Transfer', 'Return to Owner', 'Adoption'];
const AGE_GROUPS = ['Baby (<1yr)', 'Young (1-3yr)', 'Adult (4-7yr)', 'Senior (8+yr)'];

const TYPE_COLOR = { Dog: '#D9623B', Cat: '#3D7DB5' };

const OUTCOME_COLOR = {
  'Adoption':        '#2E9E60',
  'Transfer':        '#C07B28',
  'Return to Owner': '#2E72B5',
  'Euthanasia':      '#B53030',
  'Other':           '#888',
};

// ── Filters state ────────────────────────────────────────────
const filters = { type: 'All', intake: 'All', ageGroup: 'All' };

// ── Seeded jitter (consistent across re-renders) ─────────────
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = Math.imul(31, h) + s.charCodeAt(i) | 0; }
  return Math.abs(h);
}
function seededRand(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// ── Main ─────────────────────────────────────────────────────
d3.json('data/animals.json').then(data => {

  // Pre-compute stable jitter per animal
  data.forEach(d => {
    const seed = hashStr(d.id);
    d._jitterFrac = seededRand(seed) - 0.5; // −0.5 .. +0.5
  });

  // ── Scatter plot ─────────────────────────────────────────
  const margin = { top: 36, right: 28, bottom: 54, left: 148 };
  const svgW = 720, svgH = 400;
  const iW = svgW - margin.left - margin.right;
  const iH = svgH - margin.top  - margin.bottom;

  const svg = d3.select('#main-plot')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const xScale = d3.scaleLinear().domain([0, 15]).range([0, iW]);

  const yScale = d3.scalePoint()
    .domain(OUTCOMES)
    .range([iH, 0])
    .padding(0.5);

  const rowH = yScale.step(); // height of each outcome band

  // Row background bands
  OUTCOMES.forEach((oc, i) => {
    if (i % 2 === 0) {
      g.append('rect')
        .attr('x', 0).attr('y', yScale(oc) - rowH / 2)
        .attr('width', iW).attr('height', rowH)
        .attr('fill', 'rgba(180,130,80,0.06)').attr('rx', 4);
    }
  });

  // Gridlines
  g.append('g').attr('class', 'grid')
    .attr('transform', `translate(0,${iH})`)
    .call(
      d3.axisBottom(xScale).tickSize(-iH).tickFormat('')
    )
    .call(gg => gg.select('.domain').remove())
    .call(gg => gg.selectAll('line')
      .attr('stroke', '#EDE0D4').attr('stroke-dasharray', '2,4'));

  // X axis
  g.append('g').attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${iH})`)
    .call(
      d3.axisBottom(xScale)
        .tickValues([0,1,2,3,4,5,6,7,8,9,10,12,15])
        .tickFormat(d => d === 0 ? '0' : d + 'y')
    )
    .call(gg => gg.select('.domain').remove());

  // X axis label
  g.append('text')
    .attr('x', iW / 2).attr('y', iH + 46)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'DM Sans, sans-serif')
    .attr('font-size', '11px').attr('fill', '#8A7060')
    .text('Age at Intake (years)');

  // Y axis (outcome labels)
  OUTCOMES.forEach(oc => {
    // Colored dot next to label
    g.append('circle')
      .attr('cx', -16).attr('cy', yScale(oc))
      .attr('r', 5).attr('fill', OUTCOME_COLOR[oc]);

    g.append('text')
      .attr('x', -26).attr('y', yScale(oc))
      .attr('dy', '0.35em').attr('text-anchor', 'end')
      .attr('font-family', 'DM Sans, sans-serif')
      .attr('font-size', '12.5px').attr('fill', '#5A4030')
      .attr('font-weight', '500')
      .text(oc);
  });

  // Dots group
  const dotsG = g.append('g').attr('class', 'dots');

  // Tooltip
  const tooltip = d3.select('#tooltip');

  // ── Bar chart setup ────────────────────────────────────────
  const bMargin = { top: 16, right: 30, bottom: 36, left: 90 };
  const bSvgH = 140;
  const bSvgW = 860;
  const bIW = bSvgW - bMargin.left - bMargin.right;
  const bIH = bSvgH - bMargin.top  - bMargin.bottom;

  const bSvg = d3.select('#bar-chart')
    .attr('viewBox', `0 0 ${bSvgW} ${bSvgH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const bg = bSvg.append('g')
    .attr('transform', `translate(${bMargin.left},${bMargin.top})`);

  const bXScale = d3.scaleBand()
    .domain(AGE_GROUPS)
    .range([0, bIW])
    .paddingInner(0.28)
    .paddingOuter(0.15);

  const bSubScale = d3.scaleBand()
    .domain(['Dog', 'Cat'])
    .range([0, bXScale.bandwidth()])
    .padding(0.08);

  const bYScale = d3.scaleLinear().domain([0, 1]).range([bIH, 0]);

  // Y gridlines
  bg.append('g').attr('class', 'grid')
    .call(
      d3.axisLeft(bYScale).tickSize(-bIW).tickFormat('').ticks(4)
    )
    .call(gg => gg.select('.domain').remove())
    .call(gg => gg.selectAll('line')
      .attr('stroke', '#EDE0D4').attr('stroke-dasharray', '2,4'));

  // Y axis (percentages)
  bg.append('g').attr('class', 'axis')
    .call(
      d3.axisLeft(bYScale).ticks(4).tickFormat(d => `${Math.round(d*100)}%`)
    )
    .call(gg => gg.select('.domain').remove());

  // X axis
  bg.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${bIH})`)
    .call(d3.axisBottom(bXScale).tickSize(0))
    .call(gg => gg.select('.domain').attr('stroke', '#E8D9CC'));

  // Bar group placeholder
  const barGroup = bg.append('g');

  // ── Bar legend (Dog/Cat) ───────────────────────────────────
  const bLeg = bg.append('g').attr('transform', `translate(${bIW - 90}, -12)`);
  ['Dog','Cat'].forEach((t,i) => {
    const row = bLeg.append('g').attr('transform', `translate(${i * 58}, 0)`);
    row.append('rect').attr('width', 10).attr('height', 10)
      .attr('rx', 2).attr('fill', TYPE_COLOR[t]);
    row.append('text').attr('x', 14).attr('y', 9)
      .attr('font-family','DM Sans,sans-serif').attr('font-size','11px')
      .attr('fill','#8A7060').text(t);
  });

  // ── Detail card ─────────────────────────────────────────────
  let selectedId = null;

  function showDetail(d) {
    selectedId = d.id;

    // Highlight selected dot
    dotsG.selectAll('circle')
      .attr('stroke-width', dd => dd.id === d.id ? 2.5 : 0.5)
      .attr('stroke', dd => dd.id === d.id ? '#231A10' : 'white');

    const outcomeKey = 'outcome-' + d.outcome.replace(/\s+/g,'-');
    const card = d3.select('#detail-card');
    card.html(`
      <div class="detail-animal-header">
        <div class="detail-emoji">${d.type === 'Dog' ? '🐕' : '🐈'}</div>
        <div>
          <div class="detail-name">${d.name || 'Unknown'}</div>
          <div class="detail-type">${d.type} · ${d.age_group}</div>
        </div>
      </div>
      <div class="detail-rows">
        <div class="detail-row">
          <span class="detail-key">Breed</span>
          <span class="detail-val">${d.breed}</span>
        </div>
        <div class="detail-row">
          <span class="detail-key">Age</span>
          <span class="detail-val">${d.age_years < 1
            ? `${Math.round(d.age_years * 12)} months`
            : `${d.age_years} year${d.age_years !== 1 ? 's' : ''}`}</span>
        </div>
        <div class="detail-row">
          <span class="detail-key">Color</span>
          <span class="detail-val">${d.color}</span>
        </div>
        <div class="detail-row">
          <span class="detail-key">Sex</span>
          <span class="detail-val">${d.sex}</span>
        </div>
        <div class="detail-row">
          <span class="detail-key">Arrived as</span>
          <span class="detail-val">${d.intake}</span>
        </div>
        <div class="detail-row">
          <span class="detail-key">Condition</span>
          <span class="detail-val">${d.condition}</span>
        </div>
        <div class="detail-row">
          <span class="detail-key">Year</span>
          <span class="detail-val">${d.intake_year}</span>
        </div>
        <div class="detail-row" style="margin-top:6px">
          <span class="detail-key">Outcome</span>
          <span class="outcome-badge ${outcomeKey}">${d.outcome}</span>
        </div>
      </div>
    `);
  }

  // ── Update function ─────────────────────────────────────────
  function applyFilters() {
    return data.filter(d => {
      if (filters.type !== 'All' && d.type !== filters.type) return false;
      if (filters.intake !== 'All' && d.intake !== filters.intake) return false;
      if (filters.ageGroup !== 'All' && d.age_group !== filters.ageGroup) return false;
      return true;
    });
  }

  function updateStats(filtered) {
    const total = filtered.length;
    const adopted = filtered.filter(d => d.outcome === 'Adoption').length;
    const dogs = filtered.filter(d => d.type === 'Dog');
    const cats = filtered.filter(d => d.type === 'Cat');
    const dogAdopt = dogs.filter(d => d.outcome === 'Adoption').length;
    const catAdopt = cats.filter(d => d.outcome === 'Adoption').length;

    d3.select('#stat-total').text(total.toLocaleString());
    d3.select('#stat-adopted').text(
      total > 0 ? Math.round(adopted / total * 100) + '%' : '—'
    );
    d3.select('#stat-dog-pct').text(
      dogs.length > 0 ? Math.round(dogAdopt / dogs.length * 100) + '%' : '—'
    );
    d3.select('#stat-cat-pct').text(
      cats.length > 0 ? Math.round(catAdopt / cats.length * 100) + '%' : '—'
    );
  }

  function updateScatter(filtered) {
    // Compute jitter clamped to row bounds
    const jitterRange = rowH * 0.38;

    const dots = dotsG.selectAll('circle')
      .data(filtered, d => d.id);

    // ENTER
    dots.enter()
      .append('circle')
        .attr('r', 0)
        .attr('cx', d => xScale(Math.min(d.age_years, 15)))
        .attr('cy', d => yScale(d.outcome) + d._jitterFrac * jitterRange)
        .attr('fill', d => TYPE_COLOR[d.type])
        .attr('opacity', 0.72)
        .attr('stroke', d => d.id === selectedId ? '#231A10' : 'white')
        .attr('stroke-width', d => d.id === selectedId ? 2.5 : 0.5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).raise()
            .transition().duration(80).attr('r', 7).attr('opacity', 1);
          tooltip.style('opacity', 1)
            .html(`
              <strong>${d.name || 'Unknown'}</strong>
              <span style="color:var(--muted);font-size:0.78rem"> · ${d.type}</span><br>
              <span class="tip-breed">${d.breed}</span><br>
              Age: ${d.age_years < 1
                ? Math.round(d.age_years*12)+'mo'
                : d.age_years+'y'} &nbsp;·&nbsp; ${d.outcome}
            `);
        })
        .on('mousemove', function(event) {
          tooltip
            .style('left', (event.clientX + 14) + 'px')
            .style('top',  (event.clientY - 38) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).transition().duration(80).attr('r', 4).attr('opacity', 0.72);
          tooltip.style('opacity', 0);
        })
        .on('click', function(event, d) {
          showDetail(d);
        })
      .transition().duration(450).ease(d3.easeCubicOut)
        .attr('r', 4);

    // UPDATE (just ensure visibility)
    dots.transition().duration(350)
      .attr('opacity', 0.72)
      .attr('r', 4);

    // EXIT
    dots.exit()
      .transition().duration(280).ease(d3.easeCubicIn)
        .attr('r', 0).attr('opacity', 0)
      .remove();
  }

  function updateBarChart(filtered) {
    // Compute adoption rate per [age_group × type]
    const ratioMap = {};
    AGE_GROUPS.forEach(ag => {
      ratioMap[ag] = {};
      ['Dog', 'Cat'].forEach(t => {
        const group = filtered.filter(d => d.age_group === ag && d.type === t);
        const adopted = group.filter(d => d.outcome === 'Adoption').length;
        ratioMap[ag][t] = group.length > 0 ? adopted / group.length : 0;
      });
    });

    const types = ['Dog', 'Cat'];
    const barData = AGE_GROUPS.flatMap(ag =>
      types.map(t => ({ ag, t, ratio: ratioMap[ag][t] }))
    );

    const bars = barGroup.selectAll('rect').data(barData, d => d.ag + d.t);

    bars.enter().append('rect')
        .attr('x', d => bXScale(d.ag) + bSubScale(d.t))
        .attr('y', bIH)
        .attr('width', bSubScale.bandwidth())
        .attr('height', 0)
        .attr('fill', d => TYPE_COLOR[d.t])
        .attr('opacity', 0.85)
        .attr('rx', 3)
      .merge(bars)
      .transition().duration(500).ease(d3.easeCubicOut)
        .attr('x', d => bXScale(d.ag) + bSubScale(d.t))
        .attr('y', d => bYScale(d.ratio))
        .attr('width', bSubScale.bandwidth())
        .attr('height', d => bIH - bYScale(d.ratio))
        .attr('opacity', 0.85);

    bars.exit().remove();

    // Percentage labels on bars
    const labels = barGroup.selectAll('text.bar-label').data(barData, d => d.ag + d.t);

    labels.enter().append('text').attr('class', 'bar-label')
        .attr('text-anchor', 'middle')
        .attr('font-family', 'DM Sans, sans-serif')
        .attr('font-size', '9px').attr('fill', '#5A4030')
        .attr('y', bIH - 2)
      .merge(labels)
      .transition().duration(500)
        .attr('x', d => bXScale(d.ag) + bSubScale(d.t) + bSubScale.bandwidth() / 2)
        .attr('y', d => bYScale(d.ratio) - 3)
        .text(d => d.ratio > 0 ? Math.round(d.ratio * 100) + '%' : '');

    labels.exit().remove();
  }

  function update() {
    const filtered = applyFilters();
    updateStats(filtered);
    updateScatter(filtered);
    updateBarChart(filtered);
  }

  // ── Filter buttons ───────────────────────────────────────────
  function setupFilterGroup(groupId, filterKey) {
    d3.select(`#${groupId}`).selectAll('.btn-filter')
      .on('click', function() {
        const val = d3.select(this).attr('data-val');
        filters[filterKey] = val;
        d3.select(`#${groupId}`).selectAll('.btn-filter')
          .classed('active', function() {
            return d3.select(this).attr('data-val') === val;
          });
        update();
      });
  }

  setupFilterGroup('filter-type',   'type');
  setupFilterGroup('filter-intake', 'intake');
  setupFilterGroup('filter-age',    'ageGroup');

  d3.select('#reset-btn').on('click', () => {
    filters.type = 'All';
    filters.intake = 'All';
    filters.ageGroup = 'All';
    ['filter-type','filter-intake','filter-age'].forEach(id => {
      d3.select(`#${id}`).selectAll('.btn-filter')
        .classed('active', function() {
          return d3.select(this).attr('data-val') === 'All';
        });
    });

    // Clear detail card
    selectedId = null;
    d3.select('#detail-card').html(`
      <div class="detail-empty">
        <div class="detail-empty-icon">🐾</div>
        <p>Click any dot to<br>meet an animal</p>
      </div>
    `);

    update();
  });

  // ── Initial render ──────────────────────────────────────────
  update();

}).catch(err => {
  console.error('Failed to load data:', err);
  document.body.innerHTML +=
    `<div style="color:red;padding:20px">
      Error loading data/animals.json — make sure you're serving from a local server.
      <br>Try: <code>npx serve .</code> or <code>python3 -m http.server</code>
    </div>`;
});
