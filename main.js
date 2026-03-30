/* ──────────────────────────────────────────────────────────────
   Austin Animal Shelter Explorer  ·  main.js
   CSC316 Assignment 3
────────────────────────────────────────────────────────────── */

const OUTCOMES   = ['Other','Euthanasia','Transfer','Return to Owner','Adoption'];
const AGE_GROUPS  = ['Baby (<1yr)','Young (1-3yr)','Adult (4-7yr)','Senior (8+yr)'];
const COND_GROUPS = ['Normal', 'Sick', 'Injured'];

const TYPE_COLOR = {
  Dog: '#6BAED6',
  Cat: '#F5C518',
};

const CONDITION_COLOR = {
  'Normal':  '#3AAA74',
  'Sick':    '#C45050',
  'Injured': '#E09B3A',
  'Other':   '#999',
};

const OUTCOME_COLOR = {
  'Adoption':        '#3AAA74',
  'Transfer':        '#E09B3A',
  'Return to Owner': '#4A90C4',
  'Euthanasia':      '#C45050',
  'Other':           '#999',
};

const filters     = { type: 'All', intake: 'All', ageGroup: 'All', condition: 'All' };
let selectedId    = null;
let hintDismissed = false;
let barHighlight  = null;
let brushActive   = false;
let brushedIds    = new Set();
let colorMode     = 'species';
let activeInsight = null;

// New: controls which outcome row to highlight (dims all others)
let outcomeHighlight = null;
// New: when true, dims Normal/Healthy dots so Sick+Injured stand out
let dimNormalCondition = false;

function dotColor(d) {
  if (colorMode === 'condition') {
    return CONDITION_COLOR[d.condition] || '#999';
  }
  return TYPE_COLOR[d.type] || '#999';
}

function dotOpacity(d) {
  // Brush selection takes priority
  if (brushActive && brushedIds.size > 0) {
    return brushedIds.has(d.id) ? 0.88 : 0.15;
  }
  // Outcome row highlight (insight 1 and 3)
  if (outcomeHighlight !== null) {
    return d.outcome === outcomeHighlight ? 0.92 : 0.12;
  }
  // Dim Normal condition to make Sick+Injured stand out (insight 2)
  if (dimNormalCondition) {
    return d.condition === 'Normal' ? 0.12 : 0.88;
  }
  // Bar highlight mode
  if (barHighlight !== null) {
    return d.age_group === barHighlight ? 0.92 : 0.15;
  }
  return 0.82;
}

function dotRadius(d) {
  if (barHighlight !== null && d.age_group === barHighlight) return 5.6;
  return 4;
}

// ── Stable jitter ─────────────────────────────────────────────
function seededJitter(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  return (Math.abs(Math.sin(h + 1) * 10000) % 1) - 0.5;
}

// ── Custom paw cursor ─────────────────────────────────────────
const pawCursor = document.getElementById('paw-cursor');
const pawStamp  = document.getElementById('paw-stamp');

document.addEventListener('mousemove', e => {
  pawCursor.style.left = e.clientX + 'px';
  pawCursor.style.top  = e.clientY + 'px';
});

document.addEventListener('mousedown', e => {
  pawStamp.style.left = e.clientX + 'px';
  pawStamp.style.top  = e.clientY + 'px';
  pawStamp.style.transform = 'translate(-50%,-50%)';
  pawStamp.classList.remove('stamping');
  void pawStamp.offsetWidth;
  pawStamp.classList.add('stamping');
  document.body.classList.add('paw-click');
  dismissHint();
});

document.addEventListener('mouseup', () => {
  document.body.classList.remove('paw-click');
});

// ── Story banner dismiss ──────────────────────────────────────
document.getElementById('story-close').addEventListener('click', () => {
  document.getElementById('story-banner').style.display = 'none';
});

// ── Hint bubble logic ─────────────────────────────────────────
const hintBubble  = document.getElementById('hint-bubble');
const hintClose   = document.getElementById('hint-close');
let   hintTimeout = null;
let   hintAutoHide= null;

function showHint() {
  if (hintDismissed) return;
  hintBubble.classList.add('visible');
  hintAutoHide = setTimeout(() => {
    hintBubble.classList.remove('visible');
  }, 4000);
}

function dismissHint() {
  hintDismissed = true;
  clearTimeout(hintTimeout);
  clearTimeout(hintAutoHide);
  hintBubble.classList.remove('visible');
}

hintClose.addEventListener('click', dismissHint);
hintTimeout = setTimeout(showHint, 5000);

['click','mousemove','keydown'].forEach(evt => {
  document.addEventListener(evt, () => {
    if (!hintDismissed) {
      clearTimeout(hintTimeout);
      hintTimeout = setTimeout(showHint, 8000);
    }
  }, { once: false, passive: true });
});

// ── Modal logic ───────────────────────────────────────────────
const overlay    = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  overlay.classList.add('visible');
  dismissHint();
}

function closeModal() {
  overlay.classList.remove('visible');
}

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => {
  if (e.target === overlay) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── MAIN ─────────────────────────────────────────────────────
d3.json('data/animals.json').then(rawData => {

  rawData.forEach(d => { d._jitter = seededJitter(d.id); });

  // ── Scatter plot ──────────────────────────────────────────
  const margin = { top: 40, right: 32, bottom: 58, left: 152 };
  const svgW = 720, svgH = 420;
  const iW = svgW - margin.left - margin.right;
  const iH = svgH - margin.top  - margin.bottom;

  const svg = d3.select('#main-plot')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([0, 120]).range([0, iW]).clamp(true);
  const yScale = d3.scalePoint().domain(OUTCOMES).range([iH,0]).padding(0.5);
  const rowH   = yScale.step();

  // Row bands
  OUTCOMES.forEach((oc, i) => {
    g.append('rect')
      .attr('x',0).attr('y', yScale(oc) - rowH/2)
      .attr('width', iW).attr('height', rowH)
      .attr('fill', i % 2 === 0 ? 'rgba(255,143,171,0.04)' : 'transparent');
  });

  // Grid
  g.append('g').attr('transform',`translate(0,${iH})`)
    .call(d3.axisBottom(xScale).tickSize(-iH).tickFormat(''))
    .call(gg => gg.select('.domain').remove())
    .call(gg => gg.selectAll('line')
      .attr('stroke','#F0D0E0').attr('stroke-dasharray','3,5'));

  // 120d+ shaded zone
  g.append('rect')
    .attr('x', xScale(118))
    .attr('y', 0)
    .attr('width', iW - xScale(118))
    .attr('height', iH)
    .attr('fill', 'rgba(180,60,120,0.04)')
    .attr('pointer-events', 'none');

  g.append('text')
    .attr('x', xScale(119))
    .attr('y', -8)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'Nunito, sans-serif')
    .attr('font-size', '9px')
    .attr('fill', '#C0A0C0')
    .text('long stays');

  // X axis
  g.append('g').attr('class','axis').attr('transform',`translate(0,${iH})`)
    .call(d3.axisBottom(xScale)
      .tickValues([0, 7, 14, 21, 30, 45, 60, 90, 120])
      .tickFormat(d => d === 120 ? '120d+' : d === 0 ? '0' : d+'d'))
    .call(gg => gg.select('.domain').remove());

  g.append('text')
    .attr('x',iW/2).attr('y',iH+48).attr('text-anchor','middle')
    .attr('font-family','Nunito,sans-serif').attr('font-size','11px')
    .attr('fill','#A080A0').attr('font-weight','700')
    .text('Days in Shelter');

  // Brush instruction text (top-right)
  g.append('text')
    .attr('x', iW)
    .attr('y', -22)
    .attr('text-anchor', 'end')
    .attr('font-family', 'Nunito, sans-serif')
    .attr('font-size', '11px')
    .attr('fill', '#9060A0')
    .attr('font-style', 'italic')
    .text('💡 Drag to select · Clear Brush to reset');

  // Y axis labels
  OUTCOMES.forEach(oc => {
    g.append('circle')
      .attr('cx',-18).attr('cy',yScale(oc)).attr('r',6)
      .attr('fill', OUTCOME_COLOR[oc]);
    g.append('text')
      .attr('x',-28).attr('y',yScale(oc)).attr('dy','0.35em')
      .attr('text-anchor','end')
      .attr('font-family','Nunito,sans-serif').attr('font-size','13px')
      .attr('fill','#3D2040').attr('font-weight','700')
      .text(oc);
  });

  // ── Outcome row highlight overlay (for insights 1 & 3) ───────
  // These rects light up behind a specific outcome row
  const rowHighlightG = g.append('g').attr('class','row-highlights').attr('pointer-events','none');
  OUTCOMES.forEach(oc => {
    rowHighlightG.append('rect')
      .attr('class', 'row-hl row-hl-' + oc.replace(/\s+/g,'-'))
      .attr('x', 0).attr('y', yScale(oc) - rowH/2)
      .attr('width', iW).attr('height', rowH)
      .attr('rx', 4)
      .attr('fill', OUTCOME_COLOR[oc])
      .attr('opacity', 0);
  });

  function setRowHighlight(outcome) {
    // outcome = null to clear, or string to highlight
    rowHighlightG.selectAll('.row-hl')
      .transition().duration(400)
      .attr('opacity', function() {
        if (outcome === null) return 0;
        const cls = d3.select(this).attr('class');
        const key = 'row-hl-' + outcome.replace(/\s+/g,'-');
        return cls.includes(key) ? 0.08 : 0;
      });
  }

  // ── Day-range shading (for insight 2: day 0-1 zone) ──────────
  const dayRangeRect = g.append('rect')
    .attr('class','day-range-highlight')
    .attr('x', xScale(0)).attr('y', 0)
    .attr('width', xScale(7) - xScale(0))
    .attr('height', iH)
    .attr('fill', '#C45050')
    .attr('opacity', 0)
    .attr('pointer-events', 'none');

  const dayRangeLabel = g.append('text')
    .attr('class','day-range-label')
    .attr('x', xScale(3.5)).attr('y', -10)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'Nunito, sans-serif')
    .attr('font-size', '10px')
    .attr('fill', '#C45050')
    .attr('font-weight', '700')
    .attr('opacity', 0)
    .text('Day 0–7');

  function setDayRangeHighlight(visible) {
    dayRangeRect.transition().duration(400).attr('opacity', visible ? 0.07 : 0);
    dayRangeLabel.transition().duration(400).attr('opacity', visible ? 1 : 0);
  }

  // ── Brush layer (BELOW dots) ──────────────────────────────────
  const brushG = g.append('g').attr('class','brush-layer');

  // ── Dots layer ────────────────────────────────────────────────
  const dotsG   = g.append('g').attr('class','dots');
  const tooltip = d3.select('#tooltip');

  // ── Brush badge ───────────────────────────────────────────────
  const brushBadgeG = g.append('g').attr('class','brush-badge-g').style('display','none');
  const brushBadgeBg = brushBadgeG.append('rect')
    .attr('rx',6).attr('ry',6).attr('height',22)
    .attr('fill','rgba(61,32,64,0.82)');
  const brushBadgeTxt = brushBadgeG.append('text')
    .attr('y',15).attr('x',8)
    .attr('font-family','Nunito,sans-serif').attr('font-size','11px')
    .attr('fill','white').attr('font-weight','700');

  // ── Brush setup ───────────────────────────────────────────────
  function isInBrush(d, sel) {
    const cx = xScale(d.days_in_shelter !== null ? Math.min(d.days_in_shelter, 120) : 0);
    const cy = yScale(d.outcome) + d._jitter * (rowH * 0.36);
    return cx >= sel[0][0] && cx <= sel[1][0] && cy >= sel[0][1] && cy <= sel[1][1];
  }

  const clearBrushBtn = document.getElementById('clear-brush-btn');

  function onBrush(event) {
    const sel = event.selection;
    if (!sel) {
      brushActive = false;
      brushedIds  = new Set();
      brushBadgeG.style('display','none');
      clearBrushBtn.style.display = 'none';
      updateBarChart(applyFilters());
      updateLinkBridge('All');
    } else {
      brushActive = true;
      document.body.classList.add('brushed-once');
      const visible = applyFilters();
      brushedIds = new Set(visible.filter(d => isInBrush(d, sel)).map(d => d.id));
      const count = brushedIds.size;
      const label = `${count} selected`;
      brushBadgeTxt.text(label);
      const tw = label.length * 7 + 16;
      brushBadgeBg.attr('width', tw);
      const bx = Math.min(sel[1][0] + 6, iW - tw - 4);
      const by = Math.max(sel[0][1] - 26, 0);
      brushBadgeG.attr('transform', `translate(${bx},${by})`).style('display','');
      clearBrushBtn.style.display = '';
      updateBarChart(applyFilters());
      updateStats(applyFilters());
      updateLinkBridge('brush-' + brushedIds.size);
    }
    updateDotCount();
    dotsG.selectAll('circle')
      .transition().duration(200).ease(d3.easeCubicOut)
      .attr('opacity', d => dotOpacity(d));
  }

  const brush = d3.brush()
    .extent([[0,0],[iW,iH]])
    .filter(event => !event.button && event.target.tagName !== 'circle')
    .on('brush end', onBrush);

  brushG.call(brush);

  clearBrushBtn.addEventListener('click', () => {
    brushG.call(brush.clear);
    brushActive = false;
    brushedIds  = new Set();
    brushBadgeG.style('display','none');
    clearBrushBtn.style.display = 'none';
    updateBarChart(applyFilters());
    updateLinkBridge('All');
    updateDotCount();
    dotsG.selectAll('circle')
      .transition().duration(350).ease(d3.easeCubicOut)
      .attr('opacity', d => dotOpacity(d));
  });

  // ── Bar chart ─────────────────────────────────────────────────
  const bM  = { top:28, right:28, bottom:50, left:52 };
  const bSW = 860, bSH = 170;
  const bIW = bSW - bM.left - bM.right;
  const bIH = bSH - bM.top  - bM.bottom;

  const bSvg = d3.select('#bar-chart')
    .attr('viewBox',`0 0 ${bSW} ${bSH}`)
    .attr('preserveAspectRatio','xMidYMid meet');
  const bg = bSvg.append('g').attr('transform',`translate(${bM.left},${bM.top})`);

  const bXScale   = d3.scaleBand().domain(COND_GROUPS).range([0,bIW]).paddingInner(0.3).paddingOuter(0.18);
  const bSubScale = d3.scaleBand().domain(['Adoption','Euthanasia']).range([0,bXScale.bandwidth()]).padding(0.1);
  const bYScale   = d3.scaleLinear().domain([0,1]).range([bIH,0]);

  bg.append('g')
    .call(d3.axisLeft(bYScale).tickSize(-bIW).tickFormat('').ticks(4))
    .call(gg => gg.select('.domain').remove())
    .call(gg => gg.selectAll('line').attr('stroke','#F0D0E0').attr('stroke-dasharray','3,5'));

  bg.append('g').attr('class','axis')
    .call(d3.axisLeft(bYScale).ticks(4).tickFormat(d => Math.round(d*100)+'%'))
    .call(gg => gg.select('.domain').remove());

  bg.append('g').attr('class','axis').attr('transform',`translate(0,${bIH})`)
    .call(d3.axisBottom(bXScale).tickSize(0))
    .call(gg => gg.select('.domain').attr('stroke','#F0D0E0'));

  // Bar legend
  const bLeg = bg.append('g').attr('transform',`translate(${bIW-150},-18)`);
  [['Adoption','#3AAA74'],['Euthanasia','#C45050']].forEach(([label,color],i) => {
    const row = bLeg.append('g').attr('transform',`translate(${i*88},0)`);
    row.append('rect').attr('width',10).attr('height',10).attr('rx',3).attr('fill',color);
    row.append('text').attr('x',14).attr('y',9)
      .attr('font-family','Nunito,sans-serif').attr('font-size','11px')
      .attr('fill','#A080A0').attr('font-weight','700').text(label);
  });

  bg.append('text')
    .attr('x',bIW/2).attr('y',bIH+44).attr('text-anchor','middle')
    .attr('font-family','Caveat,cursive').attr('font-size','13px').attr('fill','#C0A0C0')
    .text('Adoption vs euthanasia rate by intake condition');

  // Hover overlay rects per condition group
  const barHoverG = bg.append('g');
  COND_GROUPS.forEach(cond => {
    barHoverG.append('rect')
      .attr('class','bar-bg')
      .attr('x', bXScale(cond)-4).attr('y',0)
      .attr('width', bXScale.bandwidth()+8).attr('height',bIH)
      .attr('rx',8).attr('fill','transparent')
      .style('cursor','none')
      .on('mouseenter', function() {
        d3.select(this).attr('fill','rgba(255,143,171,0.08)');
      })
      .on('mouseleave', function() {
        d3.select(this).attr('fill','transparent');
      });
  });

  const barGroup = bg.append('g');

  // ── Link bridge ───────────────────────────────────────────────
  function updateLinkBridge(mode) {
    const text  = document.getElementById('link-bridge-text');
    const inner = document.querySelector('.link-bridge-inner');
    if (mode === 'All') {
      text.textContent = 'Intake condition shapes fate — explore below ↕';
      inner.classList.remove('active');
    } else if (mode.startsWith('brush-')) {
      const n = mode.replace('brush-','');
      text.textContent = `Showing outcome breakdown for ${n} selected animals ↓`;
      inner.classList.add('active');
    } else if (mode === 'insight-1') {
      text.textContent = '⚠ Most euthanasia happens in the first 7 days — condition breakdown below';
      inner.classList.add('active');
    } else if (mode === 'insight-2') {
      text.textContent = '💔 Sick (19%) & Injured (16%) euthanasia vs Normal (1%) — see below';
      inner.classList.add('active');
    } else if (mode === 'insight-3') {
      text.textContent = '✨ Healthy: 52% adoption rate vs 24% for sick/injured — see below';
      inner.classList.add('active');
    } else {
      text.textContent = 'Intake condition shapes fate — explore below ↕';
      inner.classList.remove('active');
    }
  }

  function flashScatter() {
    const el = document.getElementById('main-plot');
    el.classList.remove('plot-flash');
    void el.offsetWidth;
    el.classList.add('plot-flash');
  }

  // ── Modal detail ──────────────────────────────────────────────
  function showAnimalModal(d) {
    selectedId = d.id;
    dotsG.selectAll('circle')
      .attr('stroke', dd => dd.id === d.id ? '#FF8FAB' : 'rgba(255,255,255,0.5)')
      .attr('stroke-width', dd => dd.id === d.id ? 3 : 0.8);

    const outcomeKey = 'outcome-' + d.outcome.replace(/\s+/g,'-');
    const ageStr = d.age_years < 1
      ? Math.round(d.age_years*12) + ' months'
      : d.age_years + ' year' + (d.age_years !== 1 ? 's' : '');

    openModal(`
      <div class="modal-animal-header">
        <div class="modal-emoji">${d.type === 'Dog' ? '🐕' : '🐈'}</div>
        <div>
          <div class="modal-name">${d.name || 'Unknown'}</div>
          <div class="modal-type">${d.type} · ${d.age_group}</div>
        </div>
      </div>
      <div class="modal-rows">
        <div class="modal-row">
          <span class="modal-key">Breed</span>
          <span class="modal-val">${d.breed}</span>
        </div>
        <div class="modal-row">
          <span class="modal-key">Age</span>
          <span class="modal-val">${ageStr}</span>
        </div>
        <div class="modal-row">
          <span class="modal-key">Color</span>
          <span class="modal-val">${d.color}</span>
        </div>
        <div class="modal-row">
          <span class="modal-key">Sex</span>
          <span class="modal-val">${d.sex}</span>
        </div>
        <div class="modal-row">
          <span class="modal-key">Arrived as</span>
          <span class="modal-val">${d.intake}</span>
        </div>
        <div class="modal-row">
          <span class="modal-key">Condition</span>
          <span class="modal-val">${d.condition}</span>
        </div>
        <div class="modal-row">
          <span class="modal-key">Year</span>
          <span class="modal-val">${d.intake_year}</span>
        </div>
        <div class="modal-row">
          <span class="modal-key">Days in shelter</span>
          <span class="modal-val">${d.days_in_shelter !== null ? d.days_in_shelter + ' days' : '—'}</span>
        </div>
        <div class="modal-row" style="margin-top:10px">
          <span class="modal-key">Outcome</span>
          <span class="outcome-badge ${outcomeKey}">${d.outcome}</span>
        </div>
      </div>
    `);
  }

  // ── Filters ───────────────────────────────────────────────────
  function applyFilters() {
    return rawData.filter(d => {
      if (filters.type      !== 'All' && d.type      !== filters.type)      return false;
      if (filters.intake    !== 'All' && d.intake    !== filters.intake)    return false;
      if (filters.ageGroup  !== 'All' && d.age_group !== filters.ageGroup)  return false;
      if (filters.condition !== 'All' && d.condition !== filters.condition) return false;
      return true;
    });
  }

  // ── Stats ─────────────────────────────────────────────────────
  function updateStats(filtered) {
    const statData = (brushActive && brushedIds.size > 0)
      ? filtered.filter(d => brushedIds.has(d.id))
      : filtered;
    const total   = statData.length;
    const adopted = statData.filter(d => d.outcome === 'Adoption').length;
    const euth    = statData.filter(d => d.outcome === 'Euthanasia').length;
    const dogs    = statData.filter(d => d.type === 'Dog');
    const cats    = statData.filter(d => d.type === 'Cat');
    d3.select('#stat-total').text(total.toLocaleString());
    d3.select('#stat-adopted').text(total > 0 ? Math.round(adopted/total*100)+'%' : '—');
    d3.select('#stat-dog-pct').text(dogs.length > 0
      ? Math.round(dogs.filter(d=>d.outcome==='Adoption').length/dogs.length*100)+'%' : '—');
    d3.select('#stat-cat-pct').text(cats.length > 0
      ? Math.round(cats.filter(d=>d.outcome==='Adoption').length/cats.length*100)+'%' : '—');
    d3.select('#stat-euthanasia')
      .text(total > 0 ? Math.round(euth/total*100)+'%' : '—');
  }

  // ── Dot count display ─────────────────────────────────────────
  function updateDotCount() {
    let count;
    if (brushActive && brushedIds.size > 0) {
      count = brushedIds.size;
    } else {
      count = applyFilters().length;
    }
    d3.select('#dot-count-num').text(count.toLocaleString());
  }

  // ── Scatter update (full data join with transitions) ──────────
  function updateScatter(filtered) {
    const jR = rowH * 0.36;
    const joined = dotsG.selectAll('circle').data(filtered, d => d.id);

    joined.exit()
      .transition().duration(350).ease(d3.easeCubicIn)
      .attr('r', 0).attr('opacity', 0).remove();

    const entered = joined.enter().append('circle')
      .attr('cx', d => xScale(d.days_in_shelter !== null ? Math.min(d.days_in_shelter, 120) : 0))
      .attr('cy', d => yScale(d.outcome) + d._jitter * jR)
      .attr('r', 0).attr('opacity', 0)
      .attr('stroke', 'rgba(255,255,255,0.5)')
      .attr('stroke-width', 0.8);

    const merged = entered.merge(joined).style('cursor','none');

    merged.transition().duration(350).ease(d3.easeCubicOut)
      .attr('cx', d => xScale(d.days_in_shelter !== null ? Math.min(d.days_in_shelter, 120) : 0))
      .attr('cy', d => yScale(d.outcome) + d._jitter * jR)
      .attr('r', d => d.id === selectedId ? 7 : dotRadius(d))
      .attr('fill', d => dotColor(d))
      .attr('opacity', d => dotOpacity(d))
      .attr('stroke', d => d.id === selectedId ? '#FF8FAB' : 'rgba(255,255,255,0.5)')
      .attr('stroke-width', d => d.id === selectedId ? 3 : 0.8);

    merged
      .on('mouseover', function(_event, d) {
        if (d.id !== selectedId)
          d3.select(this).raise().transition().duration(80).attr('r',7).attr('opacity',1);
        tooltip.style('opacity',1).html(`
          <strong style="color:#3D2040">${d.name || 'Unknown'}</strong>
          <span style="color:#A080A0;font-size:0.78rem"> · ${d.type}</span><br>
          <span style="color:#A080A0;font-size:0.78rem">${d.breed}</span><br>
          🏠 ${d.days_in_shelter !== null ? '<strong>' + d.days_in_shelter + ' days</strong> in shelter' : 'Days unknown'}
          &nbsp;·&nbsp; <strong>${d.outcome}</strong><br>
          <span style="color:#A080A0;font-size:0.78rem">Condition: ${d.condition} · Age: ${d.age_years < 1
            ? Math.round(d.age_years*12)+'mo'
            : d.age_years+'y'}</span>
        `);
      })
      .on('mousemove', function(event) {
        tooltip.style('left',(event.clientX+20)+'px').style('top',(event.clientY-48)+'px');
      })
      .on('mouseout', function(_event, d) {
        if (d.id !== selectedId)
          d3.select(this).transition().duration(80)
            .attr('r', dotRadius(d))
            .attr('opacity', dotOpacity(d));
        tooltip.style('opacity',0);
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        showAnimalModal(d);
      });
  }

  // ── Scatter highlight — only updates opacity/radius, no re-join ──
  function updateScatterHighlight() {
    dotsG.selectAll('circle')
      .transition().duration(400).ease(d3.easeCubicOut)
      .attr('opacity', d => dotOpacity(d))
      .attr('r', d => d.id === selectedId ? 7 : dotRadius(d));
  }

  // ── Bar chart update ──────────────────────────────────────────
  function updateBarChart(filtered) {
    const chartData = (brushActive && brushedIds.size > 0)
      ? filtered.filter(d => brushedIds.has(d.id))
      : filtered;

    const OUTCOME_FILL = { 'Adoption': '#3AAA74', 'Euthanasia': '#C45050' };
    const ratioMap = {};
    COND_GROUPS.forEach(cond => {
      ratioMap[cond] = {};
      ['Adoption','Euthanasia'].forEach(oc => {
        const grp = chartData.filter(d => d.condition === cond);
        ratioMap[cond][oc] = grp.length > 0
          ? grp.filter(d => d.outcome === oc).length / grp.length : 0;
      });
    });

    const barData = COND_GROUPS.flatMap(cond =>
      ['Adoption','Euthanasia'].map(oc => ({ cond, oc, ratio: ratioMap[cond][oc] }))
    );

    const bars = barGroup.selectAll('rect.bar').data(barData, d => d.cond + d.oc);
    bars.enter().append('rect').attr('class','bar')
        .attr('x', d => bXScale(d.cond) + bSubScale(d.oc))
        .attr('width', bSubScale.bandwidth())
        .attr('y', bIH).attr('height', 0).attr('rx', 4)
        .attr('fill', d => OUTCOME_FILL[d.oc])
        .style('pointer-events','none')
      .merge(bars)
      .transition().duration(500).ease(d3.easeCubicOut)
        .attr('x', d => bXScale(d.cond) + bSubScale(d.oc))
        .attr('width', bSubScale.bandwidth())
        .attr('y', d => bYScale(d.ratio))
        .attr('height', d => bIH - bYScale(d.ratio))
        .attr('opacity', 0.88);

    bars.exit().remove();

    const labels = barGroup.selectAll('text.bar-label').data(barData, d => d.cond + d.oc);
    labels.enter().append('text').attr('class','bar-label')
        .attr('text-anchor','middle')
        .attr('font-family','Nunito,sans-serif').attr('font-size','10px')
        .attr('fill','#3D2040').attr('font-weight','700')
        .attr('y', bIH)
      .merge(labels)
      .transition().duration(500)
        .attr('x', d => bXScale(d.cond) + bSubScale(d.oc) + bSubScale.bandwidth()/2)
        .attr('y', d => bYScale(d.ratio) - 4)
        .attr('opacity', 0.88)
        .text(d => d.ratio > 0 ? Math.round(d.ratio * 100) + '%' : '');

    labels.exit().remove();
    barHoverG.raise();
  }

  // ── Main update ───────────────────────────────────────────────
  function update() {
    const filtered = applyFilters();
    updateStats(filtered);
    updateScatter(filtered);
    updateBarChart(filtered);
    updateDotCount();
  }

  // ── Insight card highlight (passive — triggered by filter) ────
  function updateInsightHighlight() {
    const c = filters.condition;
    // Only highlight passively when no insight is actively selected
    if (activeInsight !== null) return;
    document.getElementById('insight-1').classList
      .toggle('highlighted', c === 'Sick' || c === 'Injured');
    document.getElementById('insight-2').classList
      .toggle('highlighted', c === 'Sick' || c === 'Injured');
    document.getElementById('insight-3').classList
      .toggle('highlighted', c === 'Normal');
  }

  // ── Helper: switch color mode UI ─────────────────────────────
  function setColorMode(mode) {
    colorMode = mode;
    document.getElementById('color-btn-species')
      .classList.toggle('active', mode === 'species');
    document.getElementById('color-btn-condition')
      .classList.toggle('active', mode === 'condition');
    document.getElementById('species-legend').style.display =
      mode === 'species' ? '' : 'none';
    document.getElementById('condition-legend').style.display =
      mode === 'condition' ? '' : 'none';
  }

  // ── Helper: set condition filter button UI ────────────────────
  function setConditionFilterUI(val) {
    filters.condition = val;
    d3.select('#filter-condition').selectAll('.btn-filter')
      .classed('active', function() {
        return d3.select(this).attr('data-val') === val;
      });
  }

  // ── Insight card activation ───────────────────────────────────
  function activateInsight(n) {
    // Remove all insight active states
    [1,2,3].forEach(i =>
      document.getElementById('insight-'+i)
        .classList.remove('highlighted','active-insight'));

    if (activeInsight === n) {
      // Toggle off — full reset
      activeInsight      = null;
      outcomeHighlight   = null;
      dimNormalCondition = false;
      setColorMode('species');
      setConditionFilterUI('All');
      setRowHighlight(null);
      setDayRangeHighlight(false);
      update();
      updateInsightHighlight();
      updateLinkBridge('All');
      return;
    }

    activeInsight = n;
    document.getElementById('insight-'+n).classList.add('highlighted','active-insight');

    if (n === 1) {
      // DATA: 89.5% of euthanasia happens within 7 days
      // → color by condition (Sick=red stands out in Euthanasia row)
      // → highlight Euthanasia row, dim everything else
      // → highlight day 0-7 zone to show WHERE it happens
      outcomeHighlight   = 'Euthanasia';
      dimNormalCondition = false;
      setColorMode('condition');
      setConditionFilterUI('All');
      setRowHighlight('Euthanasia');
      setDayRangeHighlight(true);   // shows 0-7d zone
      update();
      updateScatterHighlight();
      updateLinkBridge('insight-1');
      flashScatter();

    } else if (n === 2) {
      // DATA: Sick euthanasia 19%, Injured 16%, Normal only 1%
      // → show ALL conditions so bar chart compares all three
      // → color by condition to distinguish sick (red) + injured (orange) vs healthy (green)
      // → highlight Euthanasia row
      outcomeHighlight   = 'Euthanasia';
      dimNormalCondition = false;
      setColorMode('condition');
      setConditionFilterUI('All');
      setRowHighlight('Euthanasia');
      setDayRangeHighlight(false);
      update();
      updateScatterHighlight();
      updateLinkBridge('insight-2');
      flashScatter();

    } else if (n === 3) {
      // DATA: Normal adoption 47.5%, Sick+Injured only 23.8% — nearly 2x
      // → color by condition (green=Normal dominates Adoption row)
      // → highlight Adoption row
      // → show all conditions for comparison
      outcomeHighlight   = 'Adoption';
      dimNormalCondition = false;
      setColorMode('condition');
      setConditionFilterUI('All');
      setRowHighlight('Adoption');
      setDayRangeHighlight(false);
      update();
      updateScatterHighlight();
      updateLinkBridge('insight-3');
      flashScatter();
    }
  }

  // ── Filter buttons ────────────────────────────────────────────
  function setupFilterGroup(groupId, filterKey) {
    d3.select(`#${groupId}`).selectAll('.btn-filter')
      .on('click', function() {
        const val = d3.select(this).attr('data-val');
        filters[filterKey] = val;
        d3.select(`#${groupId}`).selectAll('.btn-filter')
          .classed('active', function() {
            return d3.select(this).attr('data-val') === val;
          });
        // Clear brush when filtering
        if (brushActive) {
          brushG.call(brush.clear);
          brushActive = false;
          brushedIds  = new Set();
          brushBadgeG.style('display','none');
          clearBrushBtn.style.display = 'none';
        }
        // If user manually changes filter, clear insight state
        if (filterKey === 'condition' && activeInsight !== null) {
          activeInsight      = null;
          outcomeHighlight   = null;
          dimNormalCondition = false;
          setRowHighlight(null);
          setDayRangeHighlight(false);
          [1,2,3].forEach(i =>
            document.getElementById('insight-'+i)
              .classList.remove('highlighted','active-insight'));
        }
        update();
        if (filterKey === 'condition') updateInsightHighlight();
      });
  }

  setupFilterGroup('filter-type',      'type');
  setupFilterGroup('filter-intake',    'intake');
  setupFilterGroup('filter-age',       'ageGroup');
  setupFilterGroup('filter-condition', 'condition');

  d3.select('#reset-btn').on('click', () => {
    filters.type = filters.intake = filters.ageGroup = filters.condition = 'All';
    selectedId         = null;
    barHighlight       = null;
    activeInsight      = null;
    outcomeHighlight   = null;
    dimNormalCondition = false;

    brushG.call(brush.clear);
    brushActive = false;
    brushedIds  = new Set();
    brushBadgeG.style('display','none');
    clearBrushBtn.style.display = 'none';

    ['filter-type','filter-intake','filter-age','filter-condition'].forEach(id => {
      d3.select(`#${id}`).selectAll('.btn-filter')
        .classed('active', function() { return d3.select(this).attr('data-val') === 'All'; });
    });

    setColorMode('species');
    setRowHighlight(null);
    setDayRangeHighlight(false);
    updateLinkBridge('All');
    update();
    updateInsightHighlight();

    [1,2,3].forEach(i =>
      document.getElementById('insight-'+i)
        .classList.remove('highlighted','active-insight'));

    closeModal();
  });

  svg.on('click', function(event) {
    if (event.target.tagName !== 'circle') {
      selectedId = null;
      dotsG.selectAll('circle')
        .attr('stroke','rgba(255,255,255,0.5)').attr('stroke-width',0.8);
    }
  });

  // ── Color mode buttons ────────────────────────────────────────
  document.getElementById('color-btn-species').addEventListener('click', function() {
    setColorMode('species');
    update();
  });

  document.getElementById('color-btn-condition').addEventListener('click', function() {
    setColorMode('condition');
    update();
  });

  // ── Insight card clicks ───────────────────────────────────────
  [1,2,3].forEach(n => {
    document.getElementById('insight-'+n)
      .addEventListener('click', () => activateInsight(n));
  });

  // ── Initial render ────────────────────────────────────────────
  update();

  // Pulse the Condition filter to guide users
  setTimeout(() => {
    const conditionGroup = document.querySelector('#filter-condition');
    conditionGroup.style.transition = 'box-shadow 0.3s';
    conditionGroup.style.boxShadow = '0 0 0 3px #FF8FAB';
    setTimeout(() => {
      conditionGroup.style.boxShadow = 'none';
    }, 1500);
  }, 2000);

}).catch(err => console.error('Data load error:', err));