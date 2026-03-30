/* ──────────────────────────────────────────────────────────────
   Austin Animal Shelter Explorer  ·  main.js
   CSC316 Assignment 3
────────────────────────────────────────────────────────────── */

const OUTCOMES   = ['Other','Euthanasia','Transfer','Return to Owner','Adoption'];
const AGE_GROUPS = ['Baby (<1yr)','Young (1-3yr)','Adult (4-7yr)','Senior (8+yr)'];

const TYPE_COLOR = {
  Dog: '#6BAED6',
  Cat: '#F5C518',
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
let barHighlight  = null; // age group highlighted from bar chart click
let brushActive   = false;
let brushedIds    = new Set();

function dotColor(d) {
  return TYPE_COLOR[d.type];
}

function dotOpacity(d) {
  // Brush selection takes priority
  if (brushActive && brushedIds.size > 0) {
    return brushedIds.has(d.id) ? 0.88 : 0.15;
  }
  // Bar highlight mode
  if (barHighlight !== null) {
    return d.age_group === barHighlight ? 0.92 : 0.15;
  }
  return 0.82;
}

function dotRadius(d) {
  // Scale up highlighted age group dots 1.4x (4 * 1.4 = 5.6)
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

  // ── Brush layer (BELOW dots so dots can receive hover/click) ─
  const brushG = g.append('g').attr('class','brush-layer');

  // ── Dots layer (ABOVE brush so they receive events first) ────
  const dotsG   = g.append('g').attr('class','dots');
  const tooltip = d3.select('#tooltip');

  // ── Brush instruction text (top-right, above plot area) ──────
  g.append('text')
    .attr('x', iW)
    .attr('y', -22)
    .attr('text-anchor', 'end')
    .attr('font-family', 'Nunito, sans-serif')
    .attr('font-size', '11px')
    .attr('fill', '#9060A0')
    .attr('font-style', 'italic')
    .text('💡 Drag to select · Clear Brush to reset');

  // ── Brush badge (SVG, above everything) ──────────────────────
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
      // approximate width (7px per char + padding)
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

  const bXScale   = d3.scaleBand().domain(AGE_GROUPS).range([0,bIW]).paddingInner(0.3).paddingOuter(0.18);
  const bSubScale = d3.scaleBand().domain(['Dog','Cat']).range([0,bXScale.bandwidth()]).padding(0.1);
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
  const bLeg = bg.append('g').attr('transform',`translate(${bIW-90},-18)`);
  ['Dog','Cat'].forEach((t,i) => {
    const row = bLeg.append('g').attr('transform',`translate(${i*58},0)`);
    row.append('rect').attr('width',10).attr('height',10).attr('rx',3).attr('fill',TYPE_COLOR[t]);
    row.append('text').attr('x',14).attr('y',9)
      .attr('font-family','Nunito,sans-serif').attr('font-size','11px')
      .attr('fill','#A080A0').attr('font-weight','700').text(t);
  });

  bg.append('text')
    .attr('x',bIW/2).attr('y',bIH+44).attr('text-anchor','middle')
    .attr('font-family','Caveat,cursive').attr('font-size','13px').attr('fill','#C0A0C0')
    .text('Click a bar group to highlight that age · click again to clear ✨');

  // Clickable overlay rects per age group
  const barHoverG = bg.append('g');
  AGE_GROUPS.forEach(ag => {
    const sk = ag.replace(/[^a-z]/gi,'_');
    barHoverG.append('rect')
      .attr('class',`bar-bg bar-bg-${sk}`)
      .attr('x', bXScale(ag)-4).attr('y',0)
      .attr('width', bXScale.bandwidth()+8).attr('height',bIH)
      .attr('rx',8).attr('fill','transparent')
      .style('cursor','none')
      .on('mouseenter', function() {
        if (barHighlight !== ag)
          d3.select(this).attr('fill','rgba(255,143,171,0.10)');
      })
      .on('mouseleave', function() {
        if (barHighlight !== ag)
          d3.select(this).attr('fill','transparent');
      })
      .on('click', function() {
        // Toggle bar highlight (does NOT filter — keeps all dots)
        if (barHighlight === ag) {
          barHighlight = null;
          AGE_GROUPS.forEach(a => {
            barHoverG.select(`.bar-bg-${a.replace(/[^a-z]/gi,'_')}`)
              .attr('fill','transparent');
          });
          updateLinkBridge('highlight-off');
        } else {
          barHighlight = ag;
          AGE_GROUPS.forEach(a => {
            barHoverG.select(`.bar-bg-${a.replace(/[^a-z]/gi,'_')}`)
              .attr('fill', a === ag ? 'rgba(255,143,171,0.15)' : 'transparent');
          });
          updateLinkBridge('highlight-' + ag);
        }
        updateScatterHighlight();
        updateDotCount();
        flashScatter();
      });
  });

  const barGroup = bg.append('g');

  // ── Link bridge ───────────────────────────────────────────────
  function updateLinkBridge(mode) {
    const text  = document.getElementById('link-bridge-text');
    const inner = document.querySelector('.link-bridge-inner');
    if (mode === 'All' || mode === 'highlight-off') {
      text.textContent = 'Click a bar below to highlight that age group in the scatter plot';
      inner.classList.remove('active');
    } else if (mode.startsWith('brush-')) {
      const n = mode.replace('brush-','');
      text.textContent = `Showing adoption breakdown for ${n} selected animals ↓`;
      inner.classList.add('active');
    } else if (mode.startsWith('highlight-')) {
      const ag = mode.replace('highlight-','');
      text.textContent = `Highlighting: ${ag} · other dots dimmed`;
      inner.classList.add('active');
    } else {
      text.textContent = `Highlighted by: ${mode} · other dots dimmed`;
      inner.classList.add('active');
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

    // EXIT — fade out and shrink to 0
    joined.exit()
      .transition().duration(350).ease(d3.easeCubicIn)
      .attr('r', 0)
      .attr('opacity', 0)
      .remove();

    // ENTER — start at 0 size and fade in
    const entered = joined.enter().append('circle')
      .attr('cx', d => xScale(d.days_in_shelter !== null ? Math.min(d.days_in_shelter, 120) : 0))
      .attr('cy', d => yScale(d.outcome) + d._jitter * jR)
      .attr('r', 0)
      .attr('opacity', 0)
      .attr('stroke', 'rgba(255,255,255,0.5)')
      .attr('stroke-width', 0.8);

    // MERGE — animate to final state
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
          <span style="color:#A080A0;font-size:0.78rem">Age: ${d.age_years < 1
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

    const ratioMap = {};
    AGE_GROUPS.forEach(ag => {
      ratioMap[ag] = {};
      ['Dog','Cat'].forEach(t => {
        const grp = chartData.filter(d => d.age_group===ag && d.type===t);
        ratioMap[ag][t] = grp.length > 0
          ? grp.filter(d=>d.outcome==='Adoption').length/grp.length : 0;
      });
    });

    const barData = AGE_GROUPS.flatMap(ag=>
      ['Dog','Cat'].map(t=>({ ag, t, ratio: ratioMap[ag][t] }))
    );

    const dimmed = d => filters.ageGroup!=='All' && filters.ageGroup!==d.ag ? 0.22 : 0.88;

    const bars = barGroup.selectAll('rect.bar').data(barData, d=>d.ag+d.t);
    bars.enter().append('rect').attr('class','bar')
        .attr('x', d=>bXScale(d.ag)+bSubScale(d.t))
        .attr('width', bSubScale.bandwidth())
        .attr('y',bIH).attr('height',0).attr('rx',4)
        .attr('fill', d=>TYPE_COLOR[d.t])
        .style('pointer-events','none')
      .merge(bars)
      .transition().duration(500).ease(d3.easeCubicOut)
        .attr('x', d=>bXScale(d.ag)+bSubScale(d.t))
        .attr('width', bSubScale.bandwidth())
        .attr('y', d=>bYScale(d.ratio))
        .attr('height', d=>bIH-bYScale(d.ratio))
        .attr('opacity', dimmed);

    bars.exit().remove();

    const labels = barGroup.selectAll('text.bar-label').data(barData, d=>d.ag+d.t);
    labels.enter().append('text').attr('class','bar-label')
        .attr('text-anchor','middle')
        .attr('font-family','Nunito,sans-serif').attr('font-size','10px')
        .attr('fill','#3D2040').attr('font-weight','700')
        .attr('y',bIH)
      .merge(labels)
      .transition().duration(500)
        .attr('x', d=>bXScale(d.ag)+bSubScale(d.t)+bSubScale.bandwidth()/2)
        .attr('y', d=>bYScale(d.ratio)-4)
        .attr('opacity', dimmed)
        .text(d => d.ratio>0 ? Math.round(d.ratio*100)+'%' : '');

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

  // ── Insight card highlight ────────────────────────────────────
  function updateInsightHighlight() {
    const c = filters.condition;
    document.getElementById('insight-1').classList
      .toggle('highlighted', c === 'Sick' || c === 'Injured');
    document.getElementById('insight-2').classList
      .toggle('highlighted', c === 'Sick' || c === 'Injured');
    document.getElementById('insight-3').classList
      .toggle('highlighted', c === 'Normal');
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
        if (filterKey === 'ageGroup') {
          AGE_GROUPS.forEach(ag => {
            barHoverG.select(`.bar-bg-${ag.replace(/[^a-z]/gi,'_')}`)
              .attr('fill', ag===val ? 'rgba(255,143,171,0.15)' : 'transparent');
          });
          updateLinkBridge(val);
        }
        // Clear brush when filtering
        if (brushActive) {
          brushG.call(brush.clear);
          brushActive = false;
          brushedIds  = new Set();
          brushBadgeG.style('display','none');
          clearBrushBtn.style.display = 'none';
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
    selectedId    = null;
    barHighlight  = null;

    // Clear brush
    brushG.call(brush.clear);
    brushActive = false;
    brushedIds  = new Set();
    brushBadgeG.style('display','none');
    clearBrushBtn.style.display = 'none';

    ['filter-type','filter-intake','filter-age','filter-condition'].forEach(id => {
      d3.select(`#${id}`).selectAll('.btn-filter')
        .classed('active', function() { return d3.select(this).attr('data-val') === 'All'; });
    });
    AGE_GROUPS.forEach(ag => {
      barHoverG.select(`.bar-bg-${ag.replace(/[^a-z]/gi,'_')}`).attr('fill','transparent');
    });
    updateLinkBridge('All');
    update();
    updateInsightHighlight();
    closeModal();
  });

  svg.on('click', function(event) {
    if (event.target.tagName !== 'circle') {
      selectedId = null;
      dotsG.selectAll('circle')
        .attr('stroke','rgba(255,255,255,0.5)').attr('stroke-width',0.8);
    }
  });

  // ── Initial render ────────────────────────────────────────────
  update();

  // Subtly pulse the Condition filter to guide users toward it
  setTimeout(() => {
    const conditionGroup = document.querySelector('#filter-condition');
    conditionGroup.style.transition = 'box-shadow 0.3s';
    conditionGroup.style.boxShadow = '0 0 0 3px #FF8FAB';
    setTimeout(() => {
      conditionGroup.style.boxShadow = 'none';
    }, 1500);
  }, 2000);

}).catch(err => console.error('Data load error:', err));
