/* ──────────────────────────────────────────────────────────────
   Austin Animal Shelter Explorer  ·  main.js
   CSC316 Assignment 3
────────────────────────────────────────────────────────────── */

const OUTCOMES   = ['Other','Euthanasia','Transfer','Return to Owner','Adoption'];
const AGE_GROUPS = ['Baby (<1yr)','Young (1-3yr)','Adult (4-7yr)','Senior (8+yr)'];

// Pink theme colors
const TYPE_COLOR = {
  Dog: '#6BAED6',   // soft blue
  Cat: '#F5C518',   // warm yellow
};

const OUTCOME_COLOR = {
  'Adoption':        '#3AAA74',
  'Transfer':        '#E09B3A',
  'Return to Owner': '#4A90C4',
  'Euthanasia':      '#C45050',
  'Other':           '#999',
};

const filters  = { type: 'All', intake: 'All', ageGroup: 'All' };
let selectedId    = null;
let hintDismissed = false;
let colorMode     = 'species';
let daysThreshold = 60; // 60 = no limit

const daysColorScale = d3.scaleSequential([1, 60], d3.interpolateRgb('#FF8FAB', '#2D0B5A'));

function dotColor(d) {
  if (colorMode === 'days') {
    if (d.days_in_shelter === null) return '#ccc';
    return daysColorScale(Math.min(Math.max(d.days_in_shelter, 1), 60));
  }
  return TYPE_COLOR[d.type];
}

function dotOpacity(d) {
  if (daysThreshold < 60 && d.days_in_shelter !== null && d.days_in_shelter > daysThreshold) {
    return 0.08;
  }
  return 0.82;
}

function updateDaysBadge(val) {
  const badge = document.getElementById('days-badge');
  if (val >= 60) {
    badge.textContent = 'No limit';
    badge.classList.remove('active');
  } else {
    badge.textContent = `≤ ${val}d`;
    badge.classList.add('active');
  }
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
  // stamp effect at click position
  pawStamp.style.left = e.clientX + 'px';
  pawStamp.style.top  = e.clientY + 'px';
  pawStamp.style.transform = 'translate(-50%,-50%)';
  pawStamp.classList.remove('stamping');
  void pawStamp.offsetWidth; // reflow
  pawStamp.classList.add('stamping');

  document.body.classList.add('paw-click');

  // dismiss hint on first interaction
  dismissHint();
});

document.addEventListener('mouseup', () => {
  document.body.classList.remove('paw-click');
});

// ── Hint bubble logic ─────────────────────────────────────────
const hintBubble  = document.getElementById('hint-bubble');
const hintClose   = document.getElementById('hint-close');
let   hintTimeout = null;
let   hintAutoHide= null;

function showHint() {
  if (hintDismissed) return;
  hintBubble.classList.add('visible');
  // auto-hide after 4s
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

// Show hint after 5 seconds of page load with no interaction
hintTimeout = setTimeout(showHint, 5000);

// Any interaction resets the timer
['click','mousemove','keydown'].forEach(evt => {
  document.addEventListener(evt, () => {
    if (!hintDismissed) {
      clearTimeout(hintTimeout);
      hintTimeout = setTimeout(showHint, 8000); // re-trigger if still no dot click
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

  const xScale = d3.scaleLinear().domain([0,15]).range([0,iW]).clamp(true);
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

  // X axis
  g.append('g').attr('class','axis').attr('transform',`translate(0,${iH})`)
    .call(d3.axisBottom(xScale)
      .tickValues([0,1,2,3,4,5,6,7,8,9,10,12,15])
      .tickFormat(d => d === 0 ? '0' : d+'y'))
    .call(gg => gg.select('.domain').remove());

  g.append('text')
    .attr('x',iW/2).attr('y',iH+48).attr('text-anchor','middle')
    .attr('font-family','Nunito,sans-serif').attr('font-size','11px')
    .attr('fill','#A080A0').attr('font-weight','700')
    .text('Age at Intake (years)');

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

  const dotsG   = g.append('g').attr('class','dots');
  const tooltip = d3.select('#tooltip');

  // ── Bar chart ─────────────────────────────────────────────
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
    .text('Click a bar group to filter by age · click again to clear ✨');

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
        if (filters.ageGroup !== ag)
          d3.select(this).attr('fill','rgba(255,143,171,0.10)');
      })
      .on('mouseleave', function() {
        if (filters.ageGroup !== ag)
          d3.select(this).attr('fill','transparent');
      })
      .on('click', function() {
        const newVal = filters.ageGroup === ag ? 'All' : ag;
        filters.ageGroup = newVal;
        d3.select('#filter-age').selectAll('.btn-filter')
          .classed('active', function() {
            return d3.select(this).attr('data-val') === newVal;
          });
        AGE_GROUPS.forEach(a => {
          barHoverG.select(`.bar-bg-${a.replace(/[^a-z]/gi,'_')}`)
            .attr('fill', a === newVal ? 'rgba(255,143,171,0.15)' : 'transparent');
        });
        update();
        updateLinkBridge(newVal);
        flashScatter();
      });
  });

  const barGroup = bg.append('g');

  // ── Link bridge ───────────────────────────────────────────
  function updateLinkBridge(ageGroup) {
    const text  = document.getElementById('link-bridge-text');
    const inner = document.querySelector('.link-bridge-inner');
    if (ageGroup === 'All') {
      text.textContent = 'Click a bar below to filter the dots above by age group';
      inner.classList.remove('active');
    } else {
      text.textContent = `Filtered by: ${ageGroup} · dots above updated!`;
      inner.classList.add('active');
    }
  }

  function flashScatter() {
    const el = document.getElementById('main-plot');
    el.classList.remove('plot-flash');
    void el.offsetWidth;
    el.classList.add('plot-flash');
  }

  // ── Modal detail ──────────────────────────────────────────
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

  // ── Update ────────────────────────────────────────────────
  function applyFilters() {
    return rawData.filter(d => {
      if (filters.type     !== 'All' && d.type      !== filters.type)     return false;
      if (filters.intake   !== 'All' && d.intake    !== filters.intake)   return false;
      if (filters.ageGroup !== 'All' && d.age_group !== filters.ageGroup) return false;
      return true;
    });
  }

  function applyFiltersWithDeadline() {
    return applyFilters().filter(d =>
      daysThreshold >= 60 || d.days_in_shelter === null || d.days_in_shelter <= daysThreshold
    );
  }

  function updateStats(filtered) {
    const total   = filtered.length;
    const adopted = filtered.filter(d => d.outcome === 'Adoption').length;
    const dogs    = filtered.filter(d => d.type === 'Dog');
    const cats    = filtered.filter(d => d.type === 'Cat');
    d3.select('#stat-total').text(total.toLocaleString());
    d3.select('#stat-adopted').text(total > 0 ? Math.round(adopted/total*100)+'%' : '—');
    d3.select('#stat-dog-pct').text(dogs.length > 0
      ? Math.round(dogs.filter(d=>d.outcome==='Adoption').length/dogs.length*100)+'%' : '—');
    d3.select('#stat-cat-pct').text(cats.length > 0
      ? Math.round(cats.filter(d=>d.outcome==='Adoption').length/cats.length*100)+'%' : '—');
  }

  function updateScatter(filtered) {
    const jR = rowH * 0.36;
    const joined = dotsG.selectAll('circle').data(filtered, d => d.id);

    // EXIT
    joined.exit().transition().duration(250).ease(d3.easeCubicIn)
      .attr('r',0).attr('opacity',0).remove();

    // ENTER
    const entered = joined.enter().append('circle')
      .attr('cx', d => xScale(d.age_years))
      .attr('cy', d => yScale(d.outcome) + d._jitter * jR)
      .attr('r',0).attr('opacity',0)
      .attr('stroke','rgba(255,255,255,0.5)').attr('stroke-width',0.8);

    // MERGE — events always on merged set
    const merged = entered.merge(joined).style('cursor','none');

    merged.transition().duration(420).ease(d3.easeCubicOut)
      .attr('cx', d => xScale(d.age_years))
      .attr('cy', d => yScale(d.outcome) + d._jitter * jR)
      .attr('r',4)
      .attr('fill', d => dotColor(d))
      .attr('opacity', d => dotOpacity(d))
      .attr('stroke', d => d.id === selectedId ? '#FF8FAB' : 'rgba(255,255,255,0.5)')
      .attr('stroke-width', d => d.id === selectedId ? 3 : 0.8);

    merged
      .on('mouseover', function(event, d) {
        if (d.id !== selectedId)
          d3.select(this).raise().transition().duration(80).attr('r',7).attr('opacity',1);
        tooltip.style('opacity',1).html(`
          <strong style="color:#3D2040">${d.name || 'Unknown'}</strong>
          <span style="color:#A080A0;font-size:0.78rem"> · ${d.type}</span><br>
          <span style="color:#A080A0;font-size:0.78rem">${d.breed}</span><br>
          Age: ${d.age_years < 1
            ? Math.round(d.age_years*12)+'mo'
            : d.age_years+'y'}
          &nbsp;·&nbsp; <strong>${d.outcome}</strong><br>
          <span style="color:#A080A0;font-size:0.78rem">🏠 ${d.days_in_shelter !== null ? d.days_in_shelter + ' days in shelter' : '—'}</span>
        `);
      })
      .on('mousemove', function(event) {
        tooltip.style('left',(event.clientX+20)+'px').style('top',(event.clientY-48)+'px');
      })
      .on('mouseout', function(event, d) {
        if (d.id !== selectedId)
          d3.select(this).transition().duration(80).attr('r',4).attr('opacity',0.8);
        tooltip.style('opacity',0);
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        showAnimalModal(d);
      });
  }

  function updateBarChart(filtered) {
    const ratioMap = {};
    AGE_GROUPS.forEach(ag => {
      ratioMap[ag] = {};
      ['Dog','Cat'].forEach(t => {
        const grp = filtered.filter(d => d.age_group===ag && d.type===t);
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

  function update() {
    const filtered     = applyFilters();
    const withDeadline = applyFiltersWithDeadline();
    updateStats(withDeadline);
    updateScatter(filtered);
    updateBarChart(withDeadline);
  }

  // ── Filter buttons ────────────────────────────────────────
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
        update();
      });
  }

  setupFilterGroup('filter-type',   'type');
  setupFilterGroup('filter-intake', 'intake');
  setupFilterGroup('filter-age',    'ageGroup');

  d3.select('#reset-btn').on('click', () => {
    filters.type = filters.intake = filters.ageGroup = 'All';
    selectedId = null;
    daysThreshold = 60;
    document.getElementById('days-slider').value = 60;
    updateDaysBadge(60);
    ['filter-type','filter-intake','filter-age'].forEach(id => {
      d3.select(`#${id}`).selectAll('.btn-filter')
        .classed('active', function() { return d3.select(this).attr('data-val') === 'All'; });
    });
    AGE_GROUPS.forEach(ag => {
      barHoverG.select(`.bar-bg-${ag.replace(/[^a-z]/gi,'_')}`).attr('fill','transparent');
    });
    updateLinkBridge('All');
    update();
    closeModal();
  });

  document.getElementById('days-slider').addEventListener('input', function() {
    daysThreshold = +this.value;
    updateDaysBadge(daysThreshold);
    update();
  });

  document.getElementById('color-btn-species').addEventListener('click', function() {
    colorMode = 'species';
    this.classList.add('active');
    document.getElementById('color-btn-days').classList.remove('active');
    document.getElementById('species-legend').style.display = '';
    document.getElementById('days-gradient-legend').style.display = 'none';
    update();
  });

  document.getElementById('color-btn-days').addEventListener('click', function() {
    colorMode = 'days';
    this.classList.add('active');
    document.getElementById('color-btn-species').classList.remove('active');
    document.getElementById('species-legend').style.display = 'none';
    document.getElementById('days-gradient-legend').style.display = '';
    update();
  });

  svg.on('click', function(event) {
    if (event.target.tagName !== 'circle') {
      selectedId = null;
      dotsG.selectAll('circle')
        .attr('stroke','rgba(255,255,255,0.5)').attr('stroke-width',0.8);
    }
  });

  update();

}).catch(err => console.error('Data load error:', err));
