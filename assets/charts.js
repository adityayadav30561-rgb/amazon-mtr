/*
 * Charts drawn from data attributes, so screens stay static HTML and open from disk. Classic script, no libraries.
 *
 *   <div class="chart" data-type="bars" data-labels='["May","June"]' data-money="true" data-height="260"
 *        data-series='[{"name":"Purchases","values":[1,2],"color":"var(--accent)"}]'></div>
 *   data-type: bars (grouped columns), line (add data-area="true" to fill under the first series), donut.
 *   Donut: data-series is [{"name":"Matte","value":2910,"color":"#..."}], data-center="7,415" data-caption="sheets".
 * Month names are written in full by the page; labels that do not fit are turned, never shortened.
 */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var el = function (name, attrs, text) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  };
  var fmt = function (n) { return Number(n).toLocaleString('en-IN'); };
  // Compact money for axis labels: 2500000 -> "₹25 lakh", 12500000 -> "₹1.25 crore"; tooltips keep the exact figure.
  var trim = function (n) { return String(+n.toFixed(2)); };
  var moneyLabel = function (v) {
    if (v === 0) return '₹0';
    return v >= 10000000 ? '₹' + trim(v / 10000000) + ' crore' : v >= 100000 ? '₹' + trim(v / 100000) + ' lakh' : '₹' + fmt(v);
  };
  // Axis scale: the smallest step of 1, 2, 2.5 or 5 times a power of ten that reaches the largest value in six intervals or fewer,
  // so a peak of 33.5 lakh gets a 40 lakh axis, not 50 lakh.
  var scale = function (max, whole) {
    max = max || 1;
    var e0 = Math.floor(Math.log10(max)) - 1;
    if (whole) e0 = Math.max(e0, 0);          // counts of things never get a fractional step
    for (var e = e0; ; e++) {
      var steps = [1, 2, 2.5, 5];
      for (var k = 0; k < steps.length; k++) {
        var step = steps[k] * Math.pow(10, e), n = Math.ceil(max / step - 1e-9);
        if (n <= 6) return { step: step, ticks: n, top: step * n };
      }
    }
  };

  function axes(box, svg, W, H, labels, series, money) {
    var all = [];
    series.forEach(function (s) { s.values.forEach(function (v) { all.push(v); }); });
    var whole = !money && all.every(function (v) { return v === Math.round(v); });
    var sc = scale(Math.max.apply(null, all), whole), top = sc.top, ticks = sc.ticks;
    var tickLabel = function (v) { return money ? moneyLabel(v) : fmt(v); };
    var widest = 0;
    for (var t = 0; t <= ticks; t++) widest = Math.max(widest, tickLabel((top * t) / ticks).length);
    var leftPad = widest * 7.2 + 14;
    var maxLabel = Math.max.apply(null, labels.map(function (l) { return l.length; }));
    var plotW = W - leftPad - 8;
    var slot = plotW / labels.length;
    var rotate = slot < maxLabel * 6.4 + 6;
    var bottom = rotate ? 18 + maxLabel * 4.6 : 26;
    var plotH = H - bottom - 8;
    for (var i = 0; i <= ticks; i++) {
      var y = 8 + plotH - (plotH * i) / ticks;
      svg.appendChild(el('line', { x1: leftPad, x2: W - 8, y1: y, y2: y, stroke: '#e7e9ee', 'stroke-width': 1 }));
      svg.appendChild(el('text', { x: leftPad - 8, y: y + 3.5, 'text-anchor': 'end' }, tickLabel((top * i) / ticks)));
    }
    var every = Math.ceil(labels.length > 8 ? labels.length / 7 : 1);
    labels.forEach(function (l, i) {
      if (i % every) return;
      var x = leftPad + slot * i + slot / 2, y = 8 + plotH + 16;
      var t = el('text', { x: x, y: y, 'text-anchor': rotate ? 'end' : 'middle' }, l);
      if (rotate) t.setAttribute('transform', 'rotate(-35 ' + x + ' ' + y + ')');
      svg.appendChild(t);
    });
    return { left: leftPad, slot: slot, plotH: plotH, top: top, y: function (v) { return 8 + plotH - (plotH * v) / top; } };
  }

  function bars(box, a) {
    var W = Math.max(box.clientWidth, 260), H = +box.getAttribute('data-height') || 260;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img' });
    var g = axes(box, svg, W, H, a.labels, a.series, a.money);
    var n = a.series.length, bw = Math.min(26, (g.slot * 0.7) / n), gap = 3;
    a.labels.forEach(function (l, i) {
      var x0 = g.left + g.slot * i + g.slot / 2 - (n * bw + (n - 1) * gap) / 2;
      a.series.forEach(function (s, k) {
        var y = g.y(s.values[i]);
        var r = el('rect', { x: x0 + k * (bw + gap), y: y, width: bw, height: Math.max(0, 8 + g.plotH - y), rx: 3, style: 'fill:' + s.color });
        r.appendChild(el('title', {}, s.name + ', ' + l + ': ' + (a.money ? '₹' : '') + fmt(s.values[i])));
        svg.appendChild(r);
      });
    });
    return svg;
  }

  function line(box, a) {
    var W = Math.max(box.clientWidth, 260), H = +box.getAttribute('data-height') || 260;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img' });
    var g = axes(box, svg, W, H, a.labels, a.series, a.money);
    a.series.forEach(function (s, k) {
      var pts = s.values.map(function (v, i) { return [g.left + g.slot * i + g.slot / 2, g.y(v)]; });
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      if (a.area && k === 0) svg.appendChild(el('path', { d: d + ' L' + pts[pts.length - 1][0] + ' ' + (8 + g.plotH) + ' L' + pts[0][0] + ' ' + (8 + g.plotH) + ' Z', style: 'fill:' + s.color + ';opacity:.12' }));
      svg.appendChild(el('path', { d: d, fill: 'none', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', style: 'stroke:' + s.color }));
      if (pts.length <= 14 && s.dots !== false) pts.forEach(function (p, i) {
        var c = el('circle', { cx: p[0], cy: p[1], r: 3, style: 'fill:#fff;stroke-width:2;stroke:' + s.color });
        c.appendChild(el('title', {}, s.name + ', ' + a.labels[i] + ': ' + fmt(s.values[i])));
        svg.appendChild(c);
      });
    });
    return svg;
  }

  function donut(box, a) {
    var size = 176, r = 68, w = 26, c = size / 2, total = a.series.reduce(function (t, s) { return t + s.value; }, 0), acc = 0;
    var svg = el('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, role: 'img' });
    svg.setAttribute('class', 'donut-svg');
    a.series.forEach(function (s) {
      var f = s.value / total, circ = 2 * Math.PI * r;
      var arc = el('circle', { cx: c, cy: c, r: r, fill: 'none', 'stroke-width': w, transform: 'rotate(' + (-90 + acc * 360) + ' ' + c + ' ' + c + ')',
        'stroke-dasharray': (f * circ - 1.5).toFixed(2) + ' ' + circ.toFixed(2), style: 'stroke:' + s.color });
      arc.appendChild(el('title', {}, s.name + ': ' + fmt(s.value) + ' (' + (f * 100).toFixed(1) + '%)'));
      svg.appendChild(arc);
      acc += f;
    });
    svg.appendChild(el('text', { x: c, y: c + 2, 'text-anchor': 'middle', class: 'big' }, a.center || fmt(total)));
    svg.appendChild(el('text', { x: c, y: c + 20, 'text-anchor': 'middle', class: 'cap' }, a.caption || ''));
    var wrap = document.createElement('div');
    wrap.className = 'donut';
    wrap.appendChild(svg);
    var lg = document.createElement('div');
    lg.className = 'legend';
    a.series.forEach(function (s) {
      var sp = document.createElement('span');
      sp.style.setProperty('--c', s.color);
      sp.innerHTML = s.name + '<em>' + (s.value / total * 100).toFixed(1) + '%</em>';
      lg.appendChild(sp);
    });
    wrap.appendChild(lg);
    return wrap;
  }

  function render(box) {
    var a = {
      type: box.getAttribute('data-type'), labels: JSON.parse(box.getAttribute('data-labels') || '[]'), series: JSON.parse(box.getAttribute('data-series') || '[]'),
      money: box.getAttribute('data-money') === 'true', area: box.getAttribute('data-area') === 'true',
      center: box.getAttribute('data-center'), caption: box.getAttribute('data-caption')
    };
    box.textContent = '';
    box.appendChild(a.type === 'donut' ? donut(box, a) : a.type === 'line' ? line(box, a) : bars(box, a));
    if (a.type !== 'donut' && a.series.length > 1) {
      var lg = document.createElement('div');
      lg.className = 'legend';
      lg.style.marginTop = '0.5rem';
      a.series.forEach(function (s) { var sp = document.createElement('span'); sp.style.setProperty('--c', s.color); sp.textContent = s.name; lg.appendChild(sp); });
      box.appendChild(lg);
    }
  }

  var draw = function () { Array.prototype.slice.call(document.querySelectorAll('.chart[data-type]')).forEach(render); };
  window.CHARTS = { draw: draw, render: render };
  draw();
  var t, last = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth === last) return;
    last = window.innerWidth; clearTimeout(t); t = setTimeout(draw, 120);
  });
})();
