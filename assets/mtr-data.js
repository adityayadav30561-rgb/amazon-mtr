/*
 * Dataset and model for the Amazon Operations Portal prototype. Classic script, no imports.
 *
 * BASE: fixed data generated with a seeded random generator, so every reviewer sees the same numbers: Seller GSTINs,
 * Business Central items and customers, Amazon listings, the September and October 2026 MTR rows, the uploads and
 * jobs already done before "today" (Friday 6 November 2026).
 * MODEL: D.model(state) applies what the person did in this session (APP.state, kept in the URL) and works out
 * everything a screen shows: errors and their status, reconciliation, document stages, Business Central uploads,
 * jobs, cancellation requests, notifications and audit entries.
 */
(function () {
  var D = window.MTRDATA = {};

  // ---------- helpers ----------
  var r2 = function (x) { return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100; };
  D.r2 = r2;
  var pad = function (n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; };
  D.pad = pad;
  var rng = function (seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  var R = rng(20261105);
  var ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); };
  var pickW = function (list, w) {
    var tot = 0, i; for (i = 0; i < list.length; i++) tot += w(list[i]);
    var x = R() * tot;
    for (i = 0; i < list.length; i++) { x -= w(list[i]); if (x <= 0) return list[i]; }
    return list[list.length - 1];
  };
  var AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = function (n) { var s = ''; for (var i = 0; i < n; i++) s += AL[Math.floor(R() * AL.length)]; return s; };
  var dt = function (y, m, d, h, mi) { return new Date(y, m - 1, d, h || 0, mi || 0).getTime(); };
  D.dt = dt;
  D.TODAY = dt(2026, 11, 6);
  D.MONTHS = [{ key: '2026-09', label: 'September 2026', y: 2026, m: 9, code: '2609', released: dt(2026, 10, 5) }, { key: '2026-10', label: 'October 2026', y: 2026, m: 10, code: '2610', released: dt(2026, 11, 5) }];
  D.monthLabel = function (k) { var m = D.MONTHS.filter(function (x) { return x.key === k; })[0]; return m ? m.label : k; };
  D.TOLERANCE = 1;   // rupees: a difference up to this is matched within tolerance

  // ---------- people ----------
  D.PEOPLE = { ADM: 'Rohit Bansal', OPS: 'Sneha Patil', FIN: 'Karan Mehta', OPS2: 'Aditi Rao', FIN2: 'Manoj Iyer', SYS: 'Integration Service' };
  D.person = function (k) { return D.PEOPLE[k] || k; };

  // ---------- states (GST state code, name, short code, city, postal code, weight, region) ----------
  D.STATES = [
    ['01', 'Jammu and Kashmir', 'JK', 'Srinagar', '190001', 0.8, 'N'], ['02', 'Himachal Pradesh', 'HP', 'Shimla', '171001', 0.6, 'N'], ['03', 'Punjab', 'PB', 'Ludhiana', '141001', 2.2, 'N'],
    ['04', 'Chandigarh', 'CH', 'Chandigarh', '160017', 1.0, 'N'], ['05', 'Uttarakhand', 'UK', 'Dehradun', '248001', 1.0, 'N'], ['06', 'Haryana', 'HR', 'Gurugram', '122002', 4.8, 'N'],
    ['07', 'Delhi', 'DL', 'New Delhi', '110017', 8.5, 'N'], ['08', 'Rajasthan', 'RJ', 'Jaipur', '302017', 3.0, 'N'], ['09', 'Uttar Pradesh', 'UP', 'Noida', '201301', 6.5, 'N'],
    ['10', 'Bihar', 'BR', 'Patna', '800001', 1.4, 'E'], ['11', 'Sikkim', 'SK', 'Gangtok', '737101', 0.5, 'E'], ['12', 'Arunachal Pradesh', 'AR', 'Itanagar', '791111', 0.2, 'E'],
    ['13', 'Nagaland', 'NL', 'Dimapur', '797112', 0.2, 'E'], ['14', 'Manipur', 'MN', 'Imphal', '795001', 0.2, 'E'], ['15', 'Mizoram', 'MZ', 'Aizawl', '796001', 0.15, 'E'],
    ['16', 'Tripura', 'TR', 'Agartala', '799001', 0.25, 'E'], ['17', 'Meghalaya', 'ML', 'Shillong', '793001', 0.25, 'E'], ['18', 'Assam', 'AS', 'Guwahati', '781005', 1.2, 'E'],
    ['19', 'West Bengal', 'WB', 'Kolkata', '700091', 4.6, 'E'], ['20', 'Jharkhand', 'JH', 'Ranchi', '834001', 0.9, 'E'], ['21', 'Odisha', 'OD', 'Bhubaneswar', '751024', 1.3, 'E'],
    ['22', 'Chhattisgarh', 'CG', 'Raipur', '492001', 0.9, 'W'], ['23', 'Madhya Pradesh', 'MP', 'Indore', '452010', 2.6, 'W'], ['24', 'Gujarat', 'GJ', 'Ahmedabad', '380015', 5.6, 'W'],
    ['26', 'Dadra and Nagar Haveli and Daman and Diu', 'DD', 'Silvassa', '396230', 0.55, 'W'], ['27', 'Maharashtra', 'MH', 'Pune', '411045', 17, 'W'], ['29', 'Karnataka', 'KA', 'Bengaluru', '560102', 11, 'S'],
    ['30', 'Goa', 'GA', 'Panaji', '403001', 0.9, 'W'], ['32', 'Kerala', 'KL', 'Kochi', '682024', 3.8, 'S'], ['33', 'Tamil Nadu', 'TN', 'Chennai', '600041', 7.4, 'T'],
    ['34', 'Puducherry', 'PY', 'Puducherry', '605001', 0.5, 'T'], ['35', 'Andaman and Nicobar Islands', 'AN', 'Port Blair', '744101', 0.45, 'E'], ['36', 'Telangana', 'TG', 'Hyderabad', '500081', 6.6, 'H'],
    ['37', 'Andhra Pradesh', 'AP', 'Visakhapatnam', '530017', 2.8, 'H'], ['38', 'Ladakh', 'LA', 'Leh', '194101', 0.5, 'N']
  ].map(function (s) { return { code: s[0], name: s[1], short: s[2], city: s[3], pin: s[4], w: s[5], region: s[6] }; });
  D.state = function (c) { return D.STATES.filter(function (s) { return s.code === c || s.short === c; })[0]; };

  // ---------- Seller GSTINs and fulfilment centres ----------
  D.GSTINS = [
    { gstin: '27AAHCC4821K1Z6', state: '27', fc: 'BOM7', fcName: 'Bhiwandi', location: 'AMZ-BOM7', since: dt(2024, 4, 1), base: true, dimension: 'AMAZON-WEST' },
    { gstin: '29AAHCC4821K1Z2', state: '29', fc: 'BLR8', fcName: 'Bengaluru', location: 'AMZ-BLR8', since: dt(2024, 4, 1), base: true, dimension: 'AMAZON-SOUTH' },
    { gstin: '06AAHCC4821K1Z0', state: '06', fc: 'DEL4', fcName: 'Farrukhnagar', location: 'AMZ-DEL4', since: dt(2024, 9, 1), base: true, dimension: 'AMAZON-NORTH' },
    { gstin: '36AAHCC4821K1ZY', state: '36', fc: 'HYD8', fcName: 'Shamshabad', location: 'AMZ-HYD8', since: dt(2025, 6, 1), base: true, dimension: 'AMAZON-SOUTH' },
    { gstin: '33AAHCC4821K1Z4', state: '33', fc: 'MAA4', fcName: 'Sriperumbudur', location: 'AMZ-MAA4', since: dt(2026, 10, 20), base: false, dimension: 'AMAZON-SOUTH' }
  ];
  // Seller-fulfilled orders ship from the company's own Bhiwandi warehouse under the Maharashtra GSTIN.
  D.MFN = { fc: 'BHW1', fcName: 'Crestline Bhiwandi Warehouse', location: 'BHW-MAIN', gstin: '27AAHCC4821K1Z6' };
  D.gstin = function (g) { return D.GSTINS.filter(function (x) { return x.gstin === g; })[0]; };

  // ---------- Business Central items ----------
  D.ITEMS = [
    ['FG-10021', 'Walnut Woodgrain Self-Adhesive Laminate Roll, 2 ft × 8 ft', '3919', 18, 'ROLL', 899],
    ['FG-10022', 'Arctic White Matte Self-Adhesive Laminate Roll, 2 ft × 8 ft', '3919', 18, 'ROLL', 849],
    ['FG-10023', 'Calacatta Marble Self-Adhesive Laminate Roll, 2 ft × 8 ft', '3919', 18, 'ROLL', 1099],
    ['FG-10024', 'Carrara Stone Self-Adhesive Laminate Roll, 2 ft × 8 ft', '3919', 18, 'ROLL', 999],
    ['FG-10025', 'Charcoal Slate Self-Adhesive Laminate Roll, 2 ft × 8 ft', '3919', 18, 'ROLL', 949],
    ['FG-10026', 'Natural Oak Self-Adhesive Laminate Roll, 2 ft × 8 ft', '3919', 18, 'ROLL', 899],
    ['FG-10031', 'Walnut Woodgrain Laminate Sheet 1 mm, 8 ft × 4 ft', '4823', 18, 'SHEET', 2450],
    ['FG-10032', 'Arctic White Matte Laminate Sheet 1 mm, 8 ft × 4 ft', '4823', 18, 'SHEET', 2290],
    ['FG-10041', 'PVC Edge Band Tape Walnut, 22 mm × 50 m', '3916', 18, 'ROLL', 649],
    ['FG-10042', 'PVC Edge Band Tape Arctic White, 22 mm × 50 m', '3916', 18, 'ROLL', 599],
    ['FG-10043', 'PVC Edge Band Tape Slate Grey, 22 mm × 50 m', '3916', 18, 'ROLL', 599],
    ['FG-10051', 'Contact Adhesive, 1 litre', '3506', 18, 'TIN', 489],
    ['FG-10052', 'Contact Adhesive, 5 litres', '3506', 18, 'TIN', 1899],
    ['FG-10061', 'Laminate Cleaner Spray, 500 ml', '3402', 18, 'BOTTLE', 349],
    ['FG-10062', 'Laminate Cleaner Concentrate, 1 litre', '3402', 18, 'BOTTLE', 549],
    ['FG-10071', 'Laminate Sample Kit, 24 Shades', '4911', 18, 'KIT', 399],
    ['FG-10072', 'Laminate Sample Kit, 36 Shades', '4911', 18, 'KIT', 549],
    ['FG-10081', 'Laminate Trimmer Bit Set, 6 Pieces', '8207', 18, 'SET', 1299],
    ['FG-10091', 'Fluted Wall Panel Charcoal, 9 ft × 6 in', '3925', 18, 'PANEL', 1150],
    ['FG-10092', 'Fluted Wall Panel Walnut, 9 ft × 6 in', '3925', 18, 'PANEL', 1150]
  ].map(function (i) { return { no: i[0], name: i[1], hsn: i[2], gst: i[3], uom: i[4], mrp: i[5], blocked: i[0] === 'FG-10024' }; });
  D.item = function (no) { return D.ITEMS.filter(function (i) { return i.no === no; })[0]; };

  // ---------- Amazon listings: [SKU, ASIN, base mapping, quantity per Amazon unit, weight, suggested item, title] ----------
  D.LISTINGS = [
    ['CRL-SA-WAL-0208', 'B0CX7K2M4Q', 'FG-10021', 1, 9, null, 'Crestline Self Adhesive Laminate Roll Walnut Wood Grain 2 x 8 ft Waterproof'],
    ['CRL-SA-WAL-0208-FBA', 'B0CX7K2M4Q', 'FG-10021', 1, 6, null, 'Crestline Self Adhesive Laminate Roll Walnut Wood Grain 2 x 8 ft Waterproof'],
    ['CRL-SA-ARC-0208', 'B0CX7K9P1D', 'FG-10022', 1, 8, null, 'Crestline Self Adhesive Laminate Roll Arctic White Matte 2 x 8 ft'],
    ['CRL-SA-MAR-0208', 'B0CX7KBV3R', 'FG-10023', 1, 8, null, 'Crestline Self Adhesive Laminate Roll Calacatta Marble 2 x 8 ft'],
    ['CRL-SA-CAR-0208', 'B0CX7KF8WN', 'FG-10024', 1, 0.7, null, 'Crestline Self Adhesive Laminate Roll Carrara Stone 2 x 8 ft'],
    ['CRL-SA-SLT-0208', 'B0CY2M4T6H', 'FG-10025', 1, 4, null, 'Crestline Self Adhesive Laminate Roll Charcoal Slate 2 x 8 ft'],
    ['CRL-LM-WAL-1MM', 'B0CZ81QX2L', 'FG-10031', 1, 2.5, null, 'Crestline Decorative Laminate Sheet 1 mm Walnut Woodgrain 8 x 4 ft'],
    ['CRL-LM-ARC-1MM', 'B0CZ81T7KM', 'FG-10032', 1, 2, null, 'Crestline Decorative Laminate Sheet 1 mm Arctic White Matte 8 x 4 ft'],
    ['CRL-EB-WAL-22-50', 'B0D1RS4HJ2', 'FG-10041', 1, 4, null, 'Crestline PVC Edge Band Tape Walnut 22 mm x 50 m'],
    ['CRL-EB-ARC-22-50', 'B0D1RS8NQ5', 'FG-10042', 1, 3.5, null, 'Crestline PVC Edge Band Tape Arctic White 22 mm x 50 m'],
    ['CRL-ADH-1L', 'B0D2HG7W1C', 'FG-10051', 1, 6, null, 'Crestline Contact Adhesive for Laminates 1 Litre'],
    ['CRL-ADH-1L-PK2', 'B0D2HG9Q4V', 'FG-10051', 2, 2, null, 'Crestline Contact Adhesive for Laminates 1 Litre Pack of 2'],
    ['CRL-ADH-5L', 'B0D2HGB3XE', 'FG-10052', 1, 1.5, null, 'Crestline Contact Adhesive for Laminates 5 Litre'],
    ['CRL-CLN-500', 'B0D3KM2Z8P', 'FG-10061', 1, 5, null, 'Crestline Laminate Cleaner Spray 500 ml'],
    ['CRL-KIT-24', 'B0D4PQ6R1T', 'FG-10071', 1, 4, null, 'Crestline Laminate Sample Kit 24 Shades'],
    ['CRL-TRM-6PC', 'B0D5VW3Y7A', 'FG-10081', 1, 1.2, null, 'Crestline Laminate Trimmer Router Bit Set 6 Pieces'],
    ['CRL-FLT-CHR-9', 'B0D6XB1C4F', 'FG-10091', 1, 3, null, 'Crestline Fluted Wall Panel Charcoal 9 ft x 6 in'],
    // New listings that went live in October 2026 without a mapping
    ['CRL-SA-OAK-0208', 'B0DN4R7T2K', null, 1, 1.2, 'FG-10026', 'Crestline Self Adhesive Laminate Roll Natural Oak 2 x 8 ft'],
    ['CRL-SA-OAK-0208-FBA', 'B0DN4R7T2K', null, 1, 0.7, 'FG-10026', 'Crestline Self Adhesive Laminate Roll Natural Oak 2 x 8 ft'],
    ['CRL-EB-GRY-22-50', 'B0DN8S2V6M', null, 1, 0.6, 'FG-10043', 'Crestline PVC Edge Band Tape Slate Grey 22 mm x 50 m'],
    ['CRL-CLN-1L', 'B0DP1T5W9Q', null, 1, 0.5, 'FG-10062', 'Crestline Laminate Cleaner Concentrate 1 Litre'],
    ['CRL-KIT-36', 'B0DP3V8X2S', null, 1, 0.6, 'FG-10072', 'Crestline Laminate Sample Kit 36 Shades'],
    ['CRL-FLT-WAL-9', 'B0DQ6Y1Z5U', null, 1, 0.45, 'FG-10092', 'Crestline Fluted Wall Panel Walnut 9 ft x 6 in']
  ].map(function (l) { return { sku: l[0], asin: l[1], base: l[2], factor: l[3], w: l[4], suggest: l[5], title: l[6], mappedOn: l[2] ? dt(2025, 3 + (l[0].length % 9), 4 + (l[0].length % 20)) : null, mappedBy: l[2] ? (l[0].length % 2 ? 'OPS' : 'OPS2') : null }; });
  D.listing = function (sku) { return D.LISTINGS.filter(function (l) { return l.sku === sku; })[0]; };
  var NEW_SKU = function (l) { return !l.base; };

  // ---------- B2B buyers: [name, state code, PAN core, existing Business Central customer or null] ----------
  D.BUYERS = [
    ['Shree Interiors Private Limited', '27', 'AAKCS2291M', 'C-10211'], ['Urban Nest Furniture LLP', '29', 'AAFFU8812Q', 'C-10218'], ['Kraftwood Modular Kitchens', '06', 'AAPFK4471H', 'C-10482'],
    ['Design Studio Eleven', '07', 'AAMFD9021K', 'C-10230'], ['Lotus Hospitality Services', '36', 'AABCL6610D', 'C-10244'], ['Vastu Build Solutions', '24', 'AAHFV3392E', 'C-10251'],
    ['Pinewood Carpentry Works', '32', 'ADKPP5582L', 'C-10263'], ['Apex Office Interiors', '33', 'AAJCA7713P', 'C-10270'], ['Greenline Contractors', '09', 'AAGFG1184R', 'C-10277'],
    ['Nirmaan Infra Projects', '23', 'AADCN4405S', 'C-10285'], ['Royal Decor House', '08', 'AAQFR2276T', 'C-10292'], ['Metro Shopfitters', '19', 'AAWFM8857U', 'C-10301'],
    ['Sai Modular Systems', '37', 'ABEFS6638V', 'C-10308'],
    // Not mapped yet: first B2B orders in October 2026
    ['Horizon Hotels and Resorts', '30', 'AAHCH3319W', null], ['Blue Door Architects', '27', 'AAIFB7720X', null], ['Elegant Spaces', '29', 'AKLPE4401Y', 'C-10515'],
    ['Woodcraft Solutions', '03', 'AAJFW9932Z', null], ['Prime Facility Management', '36', 'AACCP2263A', 'C-10522']
  ].map(function (b, i) { return { name: b[0], state: b[1], gstin: b[1] + b[2] + '1Z' + AL[(i * 7) % AL.length], bc: b[3], mappedBase: i < 13 }; });

  // ---------- Business Central customers (customer master as uploaded on 1 November 2026) ----------
  var B2C_MISSING_MAP = { '38': true, '11': true, '35': true, '26': true };     // states whose B2C customer is not mapped
  var B2C_NOT_IN_BC = { '38': true, '35': true, '26': true };                   // ... and not in Business Central either (Sikkim exists)
  D.BC_CUSTOMERS = [];
  D.STATES.forEach(function (s) {
    if (B2C_NOT_IN_BC[s.code]) return;
    D.BC_CUSTOMERS.push({ no: 'AMZB2C-' + s.short, name: 'Amazon B2C Customer — ' + s.name, type: 'Unregistered', gstin: '', state: s.code, group: 'AMAZON-B2C', terms: 'Immediate', created: s.code === '11' ? dt(2026, 11, 3) : dt(2024, 4, 1), blocked: false });
  });
  D.BUYERS.forEach(function (b) { if (b.bc) D.BC_CUSTOMERS.push({ no: b.bc, name: b.name, type: 'Registered', gstin: b.gstin, state: b.state, group: 'AMAZON-B2B', terms: '30 Days', created: b.mappedBase ? dt(2025, 2, 10) : dt(2026, 6, 18), blocked: false }); });
  D.BC_CUSTOMERS.push({ no: 'C-10155', name: 'Distributor Alpha', type: 'Registered', gstin: '27AAGCD5512F1Z9', state: '27', group: 'DOMESTIC', terms: '45 Days', created: dt(2023, 5, 2), blocked: false });
  D.BC_CUSTOMERS.push({ no: 'C-10160', name: 'Dealer Bravo', type: 'Registered', gstin: '27AAKFD7731G1Z2', state: '27', group: 'DOMESTIC', terms: '30 Days', created: dt(2023, 6, 14), blocked: false });
  D.BC_CUSTOMERS.push({ no: 'C-10171', name: 'Retailer Charlie', type: 'Registered', gstin: '27ABMPC8820H1Z5', state: '27', group: 'DOMESTIC', terms: '15 Days', created: dt(2023, 8, 21), blocked: true });
  // Customers that appear in Business Central only in the next customer extract (created there by Finance on 5 November)
  D.BC_CUSTOMERS_NEXT = [
    { no: 'AMZB2C-LA', name: 'Amazon B2C Customer — Ladakh', type: 'Unregistered', gstin: '', state: '38', group: 'AMAZON-B2C', terms: 'Immediate', created: dt(2026, 11, 5), blocked: false },
    { no: 'C-10530', name: 'Interior Junction', type: 'Registered', gstin: '27AAOFI4421B1Z3', state: '27', group: 'DOMESTIC', terms: '30 Days', created: dt(2026, 11, 5), blocked: false }
  ];

  // ---------- generate the MTR rows ----------
  var seqInv = { BOM7: 4210000, BLR8: 3170000, DEL4: 3980000, HYD8: 1250000, MAA4: 45000, BHW1: 812000 };
  var seqCn = { BOM7: 98000, BLR8: 61000, DEL4: 77000, HYD8: 21000, MAA4: 500, BHW1: 14000 };
  var fcFor = function (st, month, day, mfn) {
    if (mfn) return { fc: 'BHW1', gstin: D.MFN.gstin };
    var r = st.region;
    var g = r === 'N' ? 'DEL4' : r === 'W' ? 'BOM7' : r === 'S' ? 'BLR8' : r === 'H' ? 'HYD8' : r === 'T' ? (month === 10 && day >= 20 ? 'MAA4' : 'BLR8') : (R() < 0.5 ? 'BOM7' : 'DEL4');
    return { fc: g, gstin: D.GSTINS.filter(function (x) { return x.fc === g; })[0].gstin };
  };
  var orderId = function () { return '40' + ri(2, 8) + '-' + pad(ri(0, 9999999), 7) + '-' + pad(ri(0, 9999999), 7); };

  var buildLine = function (o, l, qty, price, promo, ship) {
    var st = D.state(o.shipTo), seller = D.gstin(o.gstin) || D.gstin(D.MFN.gstin);
    var intra = seller && seller.state === st.code;
    var it = D.item(l.base || l.suggest);
    var rate = it ? it.gst : 18;
    var hsn = it ? it.hsn : '3919';
    var principal = r2(price * qty);
    var gross = r2(principal + ship - promo);
    var excl = r2(gross / (1 + rate / 100));
    var tax = r2(gross - excl);
    var half = r2(tax / 2);
    return {
      sku: l.sku, asin: l.asin, desc: l.title, hsn: hsn, qty: qty, price: price, principal: principal, promo: promo, shipping: ship,
      rate: rate, intra: intra, excl: excl, tax: tax, cgst: intra ? half : 0, sgst: intra ? r2(tax - half) : 0, igst: intra ? 0 : tax,
      amount: gross, tcs: r2(excl * 0.005), itemId: code(14)
    };
  };

  var invoices = [];   // shipment invoices (one per invoice number) with lines
  var genMonth = function (month, n, report) {
    var mo = month === 9 ? 9 : 10, days = mo === 9 ? 30 : 31;
    var list = report === 'B2B' ? null : D.LISTINGS.filter(function (l) { return mo === 10 || !NEW_SKU(l); });
    for (var i = 0; i < n; i++) {
      var b2b = report === 'B2B';
      var buyer = b2b ? D.BUYERS[b2b && mo === 9 ? ri(0, 12) : (R() < 0.3 ? ri(13, 17) : ri(0, 12))] : null;
      var st = b2b ? D.state(buyer.state) : pickW(D.STATES, function (s) { return s.w; });
      // late October is busy (festive season); the weight leans orders toward the end of the month
      var day = Math.min(days - 2, Math.max(1, Math.round(Math.pow(R(), mo === 10 ? 0.72 : 0.95) * (days - 2)) + 1));
      var mfn = !b2b && R() < 0.15;
      var f = fcFor(st, mo, day, mfn);
      var od = dt(2026, mo, day, ri(8, 22), ri(0, 59));
      var sd = od + ri(0, 1) * 86400000 + ri(1, 8) * 3600000;
      if (new Date(sd).getMonth() + 1 !== mo) sd = od;
      seqInv[f.fc] += ri(1, 4);
      var inv = { month: '2026-' + pad(mo, 2), report: report, gstin: f.gstin, fc: f.fc, channel: mfn ? 'MFN' : 'AFN', invoiceNo: f.fc + '-' + pad(seqInv[f.fc], 7), invoiceDate: sd, orderId: orderId(), orderDate: od,
        shipmentId: code(9), shipTo: st.code, city: st.city, pin: st.pin, buyer: buyer, lines: [], payment: b2b ? 'Invoice' : (R() < 0.55 ? 'Prepaid' : 'Cash on Delivery') };
      var nl = b2b ? (R() < 0.5 ? 1 : 2) : (R() < 0.85 ? 1 : R() < 0.8 ? 2 : 3), used = {};
      for (var k = 0; k < nl; k++) {
        var l;
        if (b2b) l = D.listing(['CRL-ADH-5L', 'CRL-LM-WAL-1MM', 'CRL-LM-ARC-1MM', 'CRL-EB-WAL-22-50', 'CRL-EB-ARC-22-50', 'CRL-ADH-1L', 'CRL-FLT-CHR-9'][ri(0, 6)]);
        else { l = pickW(list, function (x) { return x.w; }); }
        if (used[l.sku]) continue;
        used[l.sku] = 1;
        var it = D.item(l.base || l.suggest);
        var qty = b2b ? ri(2, 8) : (R() < 0.8 ? 1 : R() < 0.75 ? 2 : ri(3, 4));
        var price = it.mrp * l.factor - (R() < 0.3 ? 50 : 0);
        var promo = !b2b && R() < 0.1 ? [50, 75, 100, 150][ri(0, 3)] : 0;
        var ship = mfn && price * qty < 499 && k === 0 ? 40 : 0;
        inv.lines.push(buildLine(inv, l, qty, price, promo, ship));
      }
      invoices.push(inv);
    }
  };
  genMonth(9, 540, 'B2C');
  genMonth(9, 38, 'B2B');
  genMonth(10, 610, 'B2C');
  genMonth(10, 44, 'B2B');
  invoices.sort(function (a, b) { return a.invoiceDate - b.invoiceDate; });

  // ---------- documents: shipments, refunds, cancellations, free replacements ----------
  var docs = [];
  var monthOf = function (ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2); };
  invoices.forEach(function (inv) {
    docs.push({ key: inv.invoiceNo, type: 'Shipment', inv: inv, month: inv.month, report: inv.report, date: inv.invoiceDate, lines: inv.lines, gstin: inv.gstin, fc: inv.fc });
  });
  // Refunds about 7%, cancellations about 3% (some September invoices cancelled in October), free replacements 1.5%
  var octShip = invoices.filter(function (i) { return i.month === '2026-10' && i.report === 'B2C'; });
  var sepShip = invoices.filter(function (i) { return i.month === '2026-09' && i.report === 'B2C'; });
  invoices.forEach(function (inv) {
    var x = R();
    if (x < 0.072) {
      var rd = inv.invoiceDate + ri(3, 16) * 86400000;
      if (monthOf(rd) !== '2026-09' && monthOf(rd) !== '2026-10') return;
      var li = inv.lines[0];
      var rq = li.qty > 1 && R() < 0.4 ? 1 : li.qty;
      var f = rq / li.qty;
      seqCn[inv.fc] += ri(1, 3);
      docs.push({ key: inv.fc + '-CN-' + pad(seqCn[inv.fc], 7), type: 'Refund', inv: inv, ref: inv.invoiceNo, month: monthOf(rd), report: inv.report, date: rd, gstin: inv.gstin, fc: inv.fc,
        lines: [{ sku: li.sku, asin: li.asin, desc: li.desc, hsn: li.hsn, qty: -rq, price: li.price, principal: -r2(li.principal * f), promo: -r2(li.promo * f), shipping: 0, rate: li.rate, intra: li.intra,
          excl: -r2(li.excl * f), tax: -r2(li.tax * f), cgst: -r2(li.cgst * f), sgst: -r2(li.sgst * f), igst: -r2(li.igst * f), amount: -r2(li.excl * f + li.tax * f), tcs: -r2(li.tcs * f), itemId: li.itemId }] });
    }
  });
  var cancelPick = function (list, n, toOct) {
    for (var c = 0; c < n; c++) {
      var inv = list[ri(0, list.length - 1)];
      if (inv.cancelled) continue;
      inv.cancelled = true;
      var cd = toOct ? dt(2026, 10, ri(2, 12), ri(9, 20), ri(0, 59)) : inv.invoiceDate + ri(2, 30) * 3600000;
      docs.push({ key: inv.invoiceNo + '|Cancel', type: 'Cancel', inv: inv, ref: inv.invoiceNo, month: monthOf(cd), report: inv.report, date: cd, gstin: inv.gstin, fc: inv.fc,
        lines: inv.lines.map(function (li) { var o = {}; for (var k in li) o[k] = li[k]; ['qty', 'principal', 'promo', 'shipping', 'excl', 'tax', 'cgst', 'sgst', 'igst', 'amount', 'tcs'].forEach(function (f) { o[f] = -li[f]; }); return o; }) });
    }
  };
  cancelPick(sepShip.filter(function (i) { return new Date(i.invoiceDate).getDate() > 14; }), 16, true);   // September invoices cancelled in October: need cancellation in Business Central
  cancelPick(octShip, 12, false);                                                                         // cancelled in the same month: never posted
  cancelPick(sepShip, 9, false);
  for (var fr = 0; fr < 10; fr++) {
    var base = (fr < 6 ? octShip : sepShip)[ri(10, (fr < 6 ? octShip : sepShip).length - 1)];
    var fd = base.invoiceDate + ri(4, 9) * 86400000;
    if (monthOf(fd) !== base.month) continue;
    seqInv[base.fc] += 1;
    var l0 = base.lines[0];
    var zl = {}; for (var kk in l0) zl[kk] = l0[kk];
    ['principal', 'promo', 'shipping', 'excl', 'tax', 'cgst', 'sgst', 'igst', 'amount', 'tcs'].forEach(function (f) { zl[f] = 0; });
    zl.qty = 1; zl.price = 0; zl.itemId = code(14);
    var finv = { month: base.month, report: 'B2C', gstin: base.gstin, fc: base.fc, channel: base.channel, invoiceNo: base.fc + '-' + pad(seqInv[base.fc], 7), invoiceDate: fd, orderId: base.orderId, orderDate: base.orderDate, shipmentId: code(9), shipTo: base.shipTo, city: base.city, pin: base.pin, buyer: null, lines: [zl], payment: base.payment, replaces: base.invoiceNo };
    docs.push({ key: finv.invoiceNo, type: 'FreeReplacement', inv: finv, ref: base.invoiceNo, month: base.month, report: 'B2C', date: fd, gstin: base.gstin, fc: base.fc, lines: [zl] });
  }

  // ---------- planted problems in October 2026 (the ones reconciliation finds) ----------
  var oct = function (d) { return d.month === '2026-10'; };
  var octB2CShip = docs.filter(function (d) { return oct(d) && d.report === 'B2C' && d.type === 'Shipment' && d.inv.gstin !== '33AAHCC4821K1Z4' && !B2C_MISSING_MAP[d.inv.shipTo] && !d.inv.cancelled; });
  var plant = function (i) { return octB2CShip[i]; };
  [[37, 12], [118, -38.4], [251, 4.5], [402, 22]].forEach(function (p) { var d = plant(p[0]); d.mismatch = p[1]; });
  // Two invoices Amazon reported again in October although they were in the September MTR
  [[61, 12], [233, 40]].forEach(function (p) {
    var d = plant(p[0]); var s = sepShip[p[1]];
    d.duplicateOf = s.invoiceNo; d.dupOriginalKey = d.key; d.key = s.invoiceNo; d.inv.invoiceNo = s.invoiceNo;
  });
  // Three refunds for invoices from before September (not in any uploaded MTR)
  ['DEL4-3942118', 'BOM7-4187764', 'BLR8-3139052'].forEach(function (no, i) {
    var src = octB2CShip[300 + i * 40];
    var li = src.lines[0];
    seqCn[no.slice(0, 4)] += 2;
    docs.push({ key: no.slice(0, 4) + '-CN-' + pad(seqCn[no.slice(0, 4)], 7), type: 'Refund', inv: { invoiceNo: no, orderId: orderId(), orderDate: dt(2026, 8, 20 + i), shipTo: src.inv.shipTo, city: src.inv.city, pin: src.inv.pin, gstin: src.gstin, fc: no.slice(0, 4), channel: 'AFN', payment: 'Prepaid', lines: [] }, ref: no, orphan: true,
      month: '2026-10', report: 'B2C', date: dt(2026, 10, 9 + i * 6, 14), gstin: D.GSTINS.filter(function (g) { return g.fc === no.slice(0, 4); })[0].gstin, fc: no.slice(0, 4),
      lines: [{ sku: li.sku, asin: li.asin, desc: li.desc, hsn: li.hsn, qty: -1, price: li.price, principal: -li.price, promo: 0, shipping: 0, rate: li.rate, intra: li.intra, excl: -r2(li.price / 1.18), tax: -r2(li.price - li.price / 1.18), cgst: 0, sgst: 0, igst: -r2(li.price - li.price / 1.18), amount: -li.price, tcs: -r2(li.price / 1.18 * 0.005), itemId: code(14) }] });
  });
  // HSN and tax-rate mismatches on October lines
  var octLines = [];
  docs.forEach(function (d) { if (oct(d) && d.type === 'Shipment' && d.report === 'B2C') d.lines.forEach(function (l, i) { octLines.push({ d: d, l: l, i: i }); }); });
  var edge = octLines.filter(function (x) { return x.l.sku === 'CRL-EB-WAL-22-50' || x.l.sku === 'CRL-EB-ARC-22-50'; });
  [2, 9, 15, 21].forEach(function (i) { if (edge[i]) edge[i].l.hsn = '3920'; });
  var kit = octLines.filter(function (x) { return x.l.sku === 'CRL-KIT-24'; });
  [3, 11, 17].forEach(function (i) {
    var x = kit[i]; if (!x) return;
    var l = x.l; l.rate = 12; l.excl = r2(l.amount / 1.12); l.tax = r2(l.amount - l.excl);
    if (l.intra) { l.cgst = r2(l.tax / 2); l.sgst = r2(l.tax - l.cgst); l.igst = 0; } else { l.igst = l.tax; l.cgst = l.sgst = 0; }
  });

  docs.forEach(function (d, i) {
    d.n = i;
    d.amount = r2(d.lines.reduce(function (t, l) { return t + l.amount; }, 0) + (d.mismatch || 0));
    d.calc = r2(d.lines.reduce(function (t, l) { return t + l.excl + l.tax; }, 0));
    d.excl = r2(d.lines.reduce(function (t, l) { return t + l.excl; }, 0));
    d.tax = r2(d.lines.reduce(function (t, l) { return t + l.tax; }, 0));
    d.qty = d.lines.reduce(function (t, l) { return t + l.qty; }, 0);
    d.custKey = d.report === 'B2B' && d.inv.buyer ? 'B2B|' + d.inv.buyer.gstin : 'B2C|' + d.inv.shipTo;
    d.id = d.type === 'Cancel' ? d.ref + '-C' : d.duplicateOf ? d.key + '-R' : d.key;
  });
  docs.sort(function (a, b) { return a.date - b.date || a.n - b.n; });
  D.DOCS = docs;
  D.doc = function (id) { return docs.filter(function (d) { return d.id === id; })[0]; };

  // ---------- customer mapping (portal database) ----------
  D.CUST_MAP_BASE = {};
  D.STATES.forEach(function (s) { if (!B2C_MISSING_MAP[s.code]) D.CUST_MAP_BASE['B2C|' + s.code] = 'AMZB2C-' + s.short; });
  D.BUYERS.forEach(function (b) { if (b.mappedBase) D.CUST_MAP_BASE['B2B|' + b.gstin] = b.bc; });
  D.custLabel = function (key) {
    var p = key.split('|');
    if (p[0] === 'B2C') { var s = D.state(p[1]); return 'Amazon B2C — ' + s.name; }
    var b = D.BUYERS.filter(function (x) { return x.gstin === p[1]; })[0];
    return b ? b.name : p[1];
  };

  // ---------- uploads already made ----------
  var countRows = function (month, report) { return docs.filter(function (d) { return d.month === month && d.report === report; }).reduce(function (t, d) { return t + d.lines.length; }, 0); };
  D.MTR_UPLOADS = [
    { id: 'UPL-2609-B2C', month: '2026-09', report: 'B2C', file: 'MTR_B2C-SEPTEMBER-2026-A1CRESTLINE.csv', size: 1912430, at: dt(2026, 10, 5, 11, 4), by: 'OPS', format: 'CSV' },
    { id: 'UPL-2609-B2B', month: '2026-09', report: 'B2B', file: 'MTR_B2B-SEPTEMBER-2026-A1CRESTLINE.csv', size: 156210, at: dt(2026, 10, 5, 11, 12), by: 'OPS', format: 'CSV' },
    { id: 'UPL-2610-B2C', month: '2026-10', report: 'B2C', file: 'MTR_B2C-OCTOBER-2026-A1CRESTLINE.xlsx', size: 1406882, at: dt(2026, 11, 5, 10, 42), by: 'OPS', format: 'Excel' }
  ];
  D.MTR_UPLOADS.forEach(function (u) { u.rows = countRows(u.month, u.report); u.base = true; });
  D.MTR_PENDING = [{ id: 'UPL-2610-B2B', month: '2026-10', report: 'B2B', file: 'MTR_B2B-OCTOBER-2026-A1CRESTLINE.csv', size: 171944, format: 'CSV', rows: countRows('2026-10', 'B2B') }];
  D.RECON_RUNS = [{ month: '2026-09', at: dt(2026, 10, 5, 11, 30), by: 'OPS' }, { month: '2026-10', at: dt(2026, 11, 5, 11, 5), by: 'OPS' }];

  // ---------- users ----------
  D.USERS = [
    { id: 'USR-001', name: 'Rohit Bansal', role: 'ADM', email: 'rohit.bansal@crestlinelaminates.example', phone: '+91 98200 41120', status: 'Active', last: dt(2026, 11, 6, 9, 12), created: dt(2024, 3, 18) },
    { id: 'USR-002', name: 'Sneha Patil', role: 'OPS', email: 'sneha.patil@crestlinelaminates.example', phone: '+91 98923 55018', status: 'Active', last: dt(2026, 11, 6, 9, 40), created: dt(2024, 3, 18) },
    { id: 'USR-003', name: 'Karan Mehta', role: 'FIN', email: 'karan.mehta@crestlinelaminates.example', phone: '+91 99300 61744', status: 'Active', last: dt(2026, 11, 6, 9, 55), created: dt(2024, 3, 20) },
    { id: 'USR-004', name: 'Aditi Rao', role: 'OPS', email: 'aditi.rao@crestlinelaminates.example', phone: '+91 98450 22931', status: 'Active', last: dt(2026, 11, 5, 18, 21), created: dt(2025, 1, 6) },
    { id: 'USR-005', name: 'Manoj Iyer', role: 'FIN', email: 'manoj.iyer@crestlinelaminates.example', phone: '+91 97690 83310', status: 'Active', last: dt(2026, 11, 4, 16, 2), created: dt(2025, 1, 6) },
    { id: 'USR-006', name: 'Farah Khan', role: 'OPS', email: 'farah.khan@crestlinelaminates.example', phone: '+91 98111 47206', status: 'Invited', last: null, created: dt(2026, 11, 2) },
    { id: 'USR-007', name: 'Deepak Sharma', role: 'FIN', email: 'deepak.sharma@crestlinelaminates.example', phone: '+91 98330 19087', status: 'Deactivated', last: dt(2026, 7, 30, 17, 45), created: dt(2024, 6, 11) },
    { id: 'USR-008', name: 'Integration Service', role: 'SVC', email: 'bc-integration@crestlinelaminates.example', phone: '', status: 'Active', last: dt(2026, 11, 6, 10, 0), created: dt(2024, 3, 18) }
  ];
  D.ROLE_NAMES = { ADM: 'System Administrator', OPS: 'Marketplace Operations Executive', FIN: 'Finance and Accounts Manager', SVC: 'Service Account' };

  // ---------- permissions ----------
  D.PERMS = [
    ['mtr.upload', 'Upload Amazon MTR', 'MTR Processing', 'ADM OPS'],
    ['mtr.reconcile', 'Run MTR Reconciliation', 'MTR Processing', 'ADM OPS'],
    ['mtr.view', 'View Reconciliation and Error Reports', 'MTR Processing', 'ADM OPS FIN'],
    ['err.resolve', 'Resolve Header and Item Errors', 'MTR Processing', 'ADM OPS'],
    ['map.sku', 'Map Amazon SKUs', 'Missing Data and Mapping', 'ADM OPS'],
    ['map.customer', 'Map or Create Missing Customers', 'Missing Data and Mapping', 'ADM OPS'],
    ['bc.upload', 'Upload Business Central Extracts', 'Invoice and Credit Memo Processing', 'ADM FIN'],
    ['bc.customer', 'Upload Business Central Customers', 'Invoice and Credit Memo Processing', 'ADM FIN'],
    ['bc.post', 'Create and Post Documents in Business Central', 'Business Central', 'ADM FIN'],
    ['can.request', 'Request Invoice Cancellation', 'Invoice Cancellation', 'ADM FIN'],
    ['setup.gstin', 'Set Up Seller GSTINs', 'Administration', 'ADM'],
    ['users.manage', 'Manage Users and Roles', 'Administration', 'ADM'],
    ['audit.view', 'View Audit Activity', 'Administration', 'ADM FIN']
  ].map(function (p) { return { key: p[0], name: p[1], area: p[2], roles: p[3].split(' ') }; });

  // ---------- Business Central numbering ----------
  D.soNo = function (mc, i) { return 'SO-AMZ-' + mc + '-' + pad(i, 4); };
  D.siNo = function (mc, i) { return 'PSI-' + mc + '-' + pad(i, 5); };
  D.cmNo = function (mc, i) { return 'SCM-AMZ-' + mc + '-' + pad(i, 4); };
  D.pcmNo = function (mc, i) { return 'PSCM-' + mc + '-' + pad(i, 5); };

  // ============================================================================================================
  // MODEL: applies the session state
  // ============================================================================================================
  D.model = function (st) {
    st = st || {};
    var M = { st: st };
    var lg = (st.lg || []).slice();

    // Seller GSTINs: the base set plus the ones configured in this session
    M.gstins = D.GSTINS.map(function (g) {
      var s = (st.gst || {})[g.gstin];
      var o = {}; for (var k in g) o[k] = g[k];
      o.configured = g.base || !!s;
      if (s) { o.location = s[0]; o.configuredAt = s[1]; o.configuredBy = s[2]; o.dimension = s[3] || o.dimension; }
      return o;
    });
    Object.keys(st.gst || {}).forEach(function (g) {
      if (D.gstin(g)) return;
      var s = st.gst[g];
      M.gstins.push({ gstin: g, state: g.slice(0, 2), fc: s[4] || '', fcName: s[5] || '', location: s[0], since: s[6] || s[1], base: false, configured: true, configuredAt: s[1], configuredBy: s[2], dimension: s[3], added: true });
    });
    M.gstin = function (g) { return M.gstins.filter(function (x) { return x.gstin === g; })[0]; };

    // SKU mappings
    M.listings = D.LISTINGS.map(function (l) {
      var s = (st.map || {})[l.sku];
      var o = {}; for (var k in l) o[k] = l[k];
      o.item = s ? s[0] : l.base;
      if (s) { o.factor = s[1]; o.mappedOn = s[2]; o.mappedBy = s[3]; o.fresh = true; }
      return o;
    });
    M.listing = function (sku) { return M.listings.filter(function (l) { return l.sku === sku; })[0]; };
    M.unblocked = (st.ub || {});
    M.itemBlocked = function (no) { var it = D.item(no); return it && it.blocked && !M.unblocked[no]; };

    // BC customers: the uploaded master plus customers the portal created
    var bcuUploads = (st.bcu || []).filter(function (b) { return b[0] === 'BCU'; });
    M.bcCustomers = D.BC_CUSTOMERS.slice();
    if (bcuUploads.length) M.bcCustomers = M.bcCustomers.concat(D.BC_CUSTOMERS_NEXT);
    var cus = st.cus || {};
    Object.keys(cus).forEach(function (k) {
      var c = cus[k];
      if (c[0] === 'N' && !M.bcCustomers.some(function (x) { return x.no === c[1]; })) {
        var p = k.split('|');
        M.bcCustomers.push({ no: c[1], name: c[2], type: p[0] === 'B2B' ? 'Registered' : 'Unregistered', gstin: p[0] === 'B2B' ? p[1] : '', state: p[0] === 'B2B' ? p[1].slice(0, 2) : p[1], group: p[0] === 'B2B' ? 'AMAZON-B2B' : 'AMAZON-B2C', terms: p[0] === 'B2B' ? '30 Days' : 'Immediate', created: c[3], blocked: false, byPortal: true });
      }
    });
    M.bcCustomer = function (no) { return M.bcCustomers.filter(function (c) { return c.no.toUpperCase() === String(no).toUpperCase(); })[0]; };
    M.custMap = {};
    Object.keys(D.CUST_MAP_BASE).forEach(function (k) { M.custMap[k] = D.CUST_MAP_BASE[k]; });
    Object.keys(cus).forEach(function (k) { M.custMap[k] = cus[k][1]; });

    // MTR uploads
    M.uploads = D.MTR_UPLOADS.slice();
    (st.up || []).forEach(function (u) {
      var p = D.MTR_PENDING.filter(function (x) { return x.id === u[0]; })[0];
      if (p && !M.uploads.some(function (x) { return x.id === p.id; })) M.uploads.push({ id: p.id, month: p.month, report: p.report, file: u[3] || p.file, size: u[4] || p.size, rows: p.rows, at: u[1], by: u[2], format: /xlsx$/i.test(u[3] || '') ? 'Excel' : 'CSV', fresh: true });
    });
    M.uploaded = function (month, report) { return M.uploads.some(function (u) { return u.month === month && u.report === report; }); };
    M.pending = D.MTR_PENDING.filter(function (p) { return !M.uploads.some(function (u) { return u.id === p.id; }); });
    M.upload = function (id) { return M.uploads.filter(function (u) { return u.id === id; })[0]; };

    // Documents in the database (uploaded months and reports only)
    M.docs = D.DOCS.filter(function (d) { return M.uploaded(d.month, d.report); });
    M.doc = function (id) { return M.docs.filter(function (d) { return d.id === id; })[0]; };

    // documents that never go to Business Central: cancelled in the same month (shipment and its cancellation net to zero)
    var cancelledSame = {};
    M.docs.forEach(function (d) { if (d.type === 'Cancel' && d.month === d.inv.month) cancelledSame[d.ref] = true; });
    M.netZero = function (d) { return (d.type === 'Shipment' && cancelledSame[d.key]) || (d.type === 'Cancel' && cancelledSame[d.ref]); };

    // ---------- errors ----------
    var res = st.res || {};
    var errs = [], items = [];
    var hn = 0, inn = 0;
    var sepPosted = function (no) { return D.DOCS.some(function (x) { return x.month === '2026-09' && x.type === 'Shipment' && x.key === no; }); };
    M.docs.forEach(function (d) {
      var mc = d.month.replace('20', '').replace('-', '');
      var push = function (type, detail, how) {
        hn++;
        var id = 'HDR-' + mc + '-' + pad(hn, 4);
        errs.push({ id: id, doc: d, type: type, detail: detail, how: how, month: d.month });
      };
      if (d.month === '2026-10' && d.type !== 'Cancel' && !M.netZero(d)) {
        if (d.gstin === '33AAHCC4821K1Z4') push('Seller GSTIN Not Configured', 'Seller GSTIN ' + d.gstin + ' (Tamil Nadu, MAA4) is not set up in the portal', 'gstin');
        if (!D.CUST_MAP_BASE[d.custKey]) push('Customer Not Mapped', D.custLabel(d.custKey) + ' has no Business Central customer', 'customer');
        if (d.mismatch) push('Invoice Amount Mismatch', 'Invoice amount ' + d.amount.toFixed(2) + ' does not equal tax-exclusive value plus tax ' + d.calc.toFixed(2), 'amount');
        if (d.duplicateOf && sepPosted(d.key)) push('Duplicate Invoice Number', 'Invoice ' + d.key + ' is already in the September 2026 MTR and was posted', 'duplicate');
        if (d.orphan) push('Refund Without Original Invoice', 'Original invoice ' + d.ref + ' is not in any uploaded MTR', 'orphan');
        d.lines.forEach(function (l, li) {
          var L = M.listing(l.sku), base = D.listing(l.sku);
          var ipush = function (type, detail, how) {
            inn++;
            items.push({ id: 'ITM-' + mc + '-' + pad(inn, 4), doc: d, line: l, li: li, type: type, detail: detail, how: how, month: d.month });
          };
          if (!base.base) ipush('SKU Not Mapped', 'Amazon SKU ' + l.sku + ' has no Business Central item', 'sku');
          var it = D.item(base.base || base.suggest);
          if (it && l.hsn !== it.hsn && d.type !== 'Cancel') ipush('HSN Code Mismatch', 'MTR HSN ' + l.hsn + ', item ' + it.no + ' HSN ' + it.hsn, 'hsn');
          if (it && l.rate !== it.gst && d.type !== 'Cancel') ipush('Tax Rate Mismatch', 'MTR GST rate ' + l.rate + '%, item ' + it.no + ' GST rate ' + it.gst + '%', 'rate');
          if (base.base && D.item(base.base).blocked && d.type !== 'Cancel') ipush('Item Blocked in Business Central', 'Item ' + base.base + ' is blocked in Business Central', 'blocked');
        });
      }
    });
    var statusOf = function (e) {
      var r = res[e.id];
      if (r) return { status: r[0] === 'exclude' ? 'Excluded' : 'Resolved', action: r[0], at: r[1], by: r[2], note: r[3] || '' };
      if (e.how === 'gstin' && M.gstin(e.doc.gstin).configured) { var g = M.gstin(e.doc.gstin); return { status: 'Resolved', action: 'gstin', at: g.configuredAt, by: g.configuredBy, note: 'Seller GSTIN set up' }; }
      if (e.how === 'customer' && M.custMap[e.doc.custKey]) { var c = cus[e.doc.custKey]; return { status: 'Resolved', action: 'customer', at: c ? c[3] : 0, by: c ? c[4] : '', note: (c && c[0] === 'N' ? 'Customer created ' : 'Mapped to ') + M.custMap[e.doc.custKey] }; }
      if (e.how === 'sku' && M.listing(e.line.sku).item) { var m = (st.map || {})[e.line.sku]; return { status: 'Resolved', action: 'sku', at: m ? m[2] : 0, by: m ? m[3] : '', note: 'Mapped to ' + M.listing(e.line.sku).item }; }
      if (e.how === 'blocked' && M.unblocked[D.listing(e.line.sku).base]) { var u = M.unblocked[D.listing(e.line.sku).base]; return { status: 'Resolved', action: 'blocked', at: u[0], by: u[1], note: 'Item unblocked in Business Central' }; }
      if (e.how === 'blocked' && M.listing(e.line.sku).item !== D.listing(e.line.sku).base) { var m2 = (st.map || {})[e.line.sku]; return { status: 'Resolved', action: 'blocked', at: m2[2], by: m2[3], note: 'Mapped to ' + m2[0] }; }
      return { status: 'Open' };
    };
    errs.forEach(function (e) { var s = statusOf(e); for (var k in s) e[k] = s[k]; });
    items.forEach(function (e) { var s = statusOf(e); for (var k in s) e[k] = s[k]; });
    M.headerErrors = errs;
    M.itemErrors = items;
    M.error = function (id) { return errs.concat(items).filter(function (e) { return e.id === id; })[0]; };
    var openBy = {};
    errs.concat(items).forEach(function (e) { if (e.status === 'Open') (openBy[e.doc.id] = openBy[e.doc.id] || []).push(e); });
    var exclBy = {};
    errs.concat(items).forEach(function (e) { if (e.status === 'Excluded') (exclBy[e.doc.id] = exclBy[e.doc.id] || []).push(e); });
    M.openErrors = function (d) { return openBy[d.id] || []; };
    M.docErrors = function (d) { return errs.concat(items).filter(function (e) { return e.doc === d; }); };
    M.excluded = function (d) { return !!exclBy[d.id]; };


    // ---------- Business Central jobs ----------
    // Base: September all done; October sales orders and credit memos created on 5 November.
    var jobs = [];
    var mk = function (id, type, month, at, by, docIds, fail, extra) { var j = { id: id, type: type, month: month, at: at, by: by, docIds: docIds, fail: fail || {}, base: !!extra.base }; for (var k in extra) j[k] = extra[k]; jobs.push(j); return j; };
    var eligibleSO = function (month, asOfErr) {
      return D.DOCS.filter(function (d) {
        if (d.month !== month || !(d.type === 'Shipment' || d.type === 'FreeReplacement')) return false;
        if (!M.uploaded(d.month, d.report)) return false;
        if (cancelledSame[d.key]) return false;
        return asOfErr(d);
      });
    };
    var initialOk = function (d) { return d.month !== '2026-10' || (d.gstin !== '33AAHCC4821K1Z4' && D.CUST_MAP_BASE[d.custKey] && !d.mismatch && !d.duplicateOf && d.lines.every(function (l) { var b = D.listing(l.sku); var it = D.item(b.base || b.suggest); return b.base && !D.item(b.base).blocked && l.hsn === it.hsn && l.rate === it.gst; })); };
    var sepSO = eligibleSO('2026-09', function () { return true; });
    var sepCM = D.DOCS.filter(function (d) { return d.month === '2026-09' && d.type === 'Refund' && M.uploaded(d.month, d.report); });
    var sepCan = [];
    mk('JOB-2609-01', 'Create Sales Orders', '2026-09', dt(2026, 10, 6, 15, 2), 'FIN', sepSO.map(function (d) { return d.id; }), {}, { base: true });
    mk('JOB-2609-02', 'Create Sales Credit Memos', '2026-09', dt(2026, 10, 6, 15, 40), 'FIN', sepCM.map(function (d) { return d.id; }), {}, { base: true });
    mk('JOB-2609-03', 'Post Sales Orders', '2026-09', dt(2026, 10, 7, 11, 15), 'FIN', sepSO.map(function (d) { return d.id; }), {}, { base: true });
    mk('JOB-2609-04', 'Post Sales Credit Memos', '2026-09', dt(2026, 10, 7, 12, 5), 'FIN', sepCM.map(function (d) { return d.id; }), {}, { base: true });
    var octSO = D.DOCS.filter(function (d) { return d.month === '2026-10' && d.report === 'B2C' && (d.type === 'Shipment' || d.type === 'FreeReplacement') && !cancelledSame[d.key] && initialOk(d); });
    var failSO = {}; failSO[octSO[140].id] = 'Request timed out after 60 seconds'; failSO[octSO[388].id] = 'Request timed out after 60 seconds';
    D.FAILED_SO = Object.keys(failSO);
    mk('JOB-2610-01', 'Create Sales Orders', '2026-10', dt(2026, 11, 5, 15, 10), 'FIN', octSO.map(function (d) { return d.id; }), failSO, { base: true });
    var octCM = D.DOCS.filter(function (d) { return d.month === '2026-10' && d.report === 'B2C' && d.type === 'Refund' && !d.orphan && initialOk(d) && D.CUST_MAP_BASE[d.custKey]; });
    mk('JOB-2610-02', 'Create Sales Credit Memos', '2026-10', dt(2026, 11, 5, 16, 5), 'FIN', octCM.map(function (d) { return d.id; }), {}, { base: true });
    // Jobs started in this session: [id, type, month, at, by, [docIds]]
    (st.job || []).forEach(function (j) { mk(j[0], j[1], j[2], j[3], j[4], j[5] || [], {}, { fresh: true }); });
    // the one planted posting failure: the last October order dated 31 October is outside the allowed posting dates
    jobs.forEach(function (j) {
      if (j.type === 'Post Sales Orders' && j.month === '2026-10' && !j.base) {
        var last = j.docIds.map(function (id) { return D.doc(id); }).filter(function (d) { return d && new Date(d.date).getDate() === 30; })[0];
        if (last) j.fail[last.id] = 'Posting date 30/10/2026 is not within your range of allowed posting dates';
      }
    });
    var retried = st.jr || {};
    jobs.forEach(function (j) {
      Object.keys(j.fail).forEach(function (id) { if (retried[j.id + '|' + id]) { j.retried = j.retried || {}; j.retried[id] = retried[j.id + '|' + id]; delete j.fail[id]; } });
      j.ok = j.docIds.filter(function (id) { return !j.fail[id]; });
      j.failed = Object.keys(j.fail);
      j.status = j.failed.length ? (j.ok.length ? 'Completed with Failures' : 'Failed') : 'Completed';
    });
    M.jobs = jobs.sort(function (a, b) { return b.at - a.at; });
    M.job = function (id) { return jobs.filter(function (j) { return j.id === id; })[0]; };
    var inJob = function (type, docId, before) {
      return jobs.filter(function (j) { return j.type === type && (before == null || (j.at <= before && !(j.retried && j.retried[docId] > before))) && j.ok.indexOf(docId) >= 0; })[0];
    };
    M.inJob = inJob;

    // Business Central document numbers, in the order the jobs created them
    var soNum = {}, cmNum = {}, siNum = {}, pcmNum = {}, cSO = {}, cCM = {}, cSI = {}, cPCM = {};
    jobs.slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (j) {
      if (!/Sales Orders|Credit Memos/.test(j.type)) return;
      var mc = j.month.replace('20', '').replace('-', '');
      var rt = j.retried || {};
      var dsorted = j.ok.slice().sort(function (a, b) { var x = D.doc(a), y = D.doc(b); return (rt[a] ? 1 : 0) - (rt[b] ? 1 : 0) || x.date - y.date || x.n - y.n; });
      dsorted.forEach(function (id) {
        if (j.type === 'Create Sales Orders' && !soNum[id]) { cSO[mc] = (cSO[mc] || 0) + 1; soNum[id] = D.soNo(mc, cSO[mc]); }
        if (j.type === 'Create Sales Credit Memos' && !cmNum[id]) { cCM[mc] = (cCM[mc] || 0) + 1; cmNum[id] = D.cmNo(mc, cCM[mc]); }
        if (j.type === 'Post Sales Orders' && !siNum[id]) { cSI[mc] = (cSI[mc] || 0) + 1; siNum[id] = D.siNo(mc, (mc === '2609' ? 18400 : 19020) + cSI[mc]); }
        if (j.type === 'Post Sales Credit Memos' && !pcmNum[id]) { cPCM[mc] = (cPCM[mc] || 0) + 1; pcmNum[id] = D.pcmNo(mc, (mc === '2609' ? 2210 : 2290) + cPCM[mc]); }
      });
    });
    M.soNo = function (d) { return soNum[d.id] || null; };
    M.cmNo = function (d) { return cmNum[d.id] || null; };
    M.siNo = function (d) { return siNum[d.id] || null; };
    M.pcmNo = function (d) { return pcmNum[d.id] || null; };
    M.postedInvoiceFor = function (invoiceNo) { var d = D.DOCS.filter(function (x) { return x.type === 'Shipment' && x.key === invoiceNo && !x.duplicateOf; })[0]; return d ? { doc: d, no: siNum[d.id] } : null; };

    // ---------- Business Central uploads ----------
    // Base: September all four; October before-posting and before-credit-memo on 5 November; customers on 1 November.
    var bc = [
      { id: 'BCU-2611-01', kind: 'BCU', month: '', at: dt(2026, 11, 1, 10, 20), by: 'FIN', file: 'BC_Customers_01-11-2026.xlsx', base: true },
      { id: 'BP-2609-01', kind: 'BP', month: '2026-09', at: dt(2026, 10, 6, 17, 10), by: 'FIN', file: 'BC_Sales_Orders_Amazon_September_2026.xlsx', base: true },
      { id: 'AP-2609-01', kind: 'AP', month: '2026-09', at: dt(2026, 10, 7, 16, 30), by: 'FIN', file: 'BC_Posted_Sales_Invoices_Amazon_September_2026.xlsx', base: true },
      { id: 'BCM-2609-01', kind: 'BCM', month: '2026-09', at: dt(2026, 10, 6, 17, 40), by: 'FIN', file: 'BC_Sales_Credit_Memos_Amazon_September_2026.xlsx', base: true },
      { id: 'ACM-2609-01', kind: 'ACM', month: '2026-09', at: dt(2026, 10, 7, 16, 55), by: 'FIN', file: 'BC_Posted_Credit_Memos_Amazon_September_2026.xlsx', base: true },
      { id: 'BP-2610-01', kind: 'BP', month: '2026-10', at: dt(2026, 11, 5, 17, 32), by: 'FIN', file: 'BC_Sales_Orders_Amazon_October_2026.xlsx', base: true },
      { id: 'BCM-2610-01', kind: 'BCM', month: '2026-10', at: dt(2026, 11, 5, 18, 4), by: 'FIN', file: 'BC_Sales_Credit_Memos_Amazon_October_2026.xlsx', base: true }
    ];
    (st.bcu || []).forEach(function (b) { bc.push({ id: b[1], kind: b[0], month: b[5] || '', at: b[2], by: b[3], file: b[4], fresh: true }); });
    M.bcUploads = bc.sort(function (a, b) { return b.at - a.at; });
    M.bcUpload = function (id) { return bc.filter(function (b) { return b.id === id; })[0]; };
    M.bcLatest = function (kind, month) { return bc.filter(function (b) { return b.kind === kind && b.month === month; })[0] || null; };
    var acts = st.bpa || {};
    // Planted Business Central differences on October sales orders (by order of creation)
    var diffSO = {};
    if (octSO.length > 300) { diffSO[octSO[52].id] = 0.4; diffSO[octSO[166].id] = 12; diffSO[octSO[275].id] = -4.5; diffSO[octSO[310].id] = 0.6; }
    var diffCM = {};
    if (octCM.length > 8) diffCM[octCM[6].id] = -8;
    var resolveRow = function (row, batch) {
      var a = acts[batch.id + '|' + row.key] || (row.status === 'Not in MTR' && acts['ign|' + row.key]) || (row.status === 'Amount Difference' && acts['accd|' + row.key]) || null;
      if (a) { row.action = a[0]; row.actionAt = a[1]; row.actionBy = a[2]; row.status = a[0] === 'accept' ? 'Difference Accepted' : a[0] === 'correct' ? 'Correction Requested' : a[0] === 'ignore' ? 'Ignored' : row.status; }
      return row;
    };
    // Rows of a Business Central upload, worked out from the jobs that had run when the file was taken.
    M.bcRows = function (b) {
      var rows = [];
      if (b.kind === 'BP' || b.kind === 'BCM') {
        var createType = b.kind === 'BP' ? 'Create Sales Orders' : 'Create Sales Credit Memos';
        var expected = M.docs.filter(function (d) {
          if (d.month !== b.month) return false;
          if (b.kind === 'BP') return (d.type === 'Shipment' || d.type === 'FreeReplacement') && !M.netZero(d) && !M.excluded(d) && (d.month === '2026-09' || d.report === 'B2C' || inJob(createType, d.id, b.at));
          return d.type === 'Refund' && !M.excluded(d) && (d.month === '2026-09' || inJob(createType, d.id, b.at) || jobs.some(function (j) { return j.type === createType && j.at <= b.at && j.fail[d.id]; }));
        });
        expected.forEach(function (d) {
          var j = inJob(createType, d.id, b.at);
          var num = b.kind === 'BP' ? soNum[d.id] : cmNum[d.id];
          if (!j) {
            var failedIn = jobs.filter(function (x) { return x.type === createType && x.at <= b.at && (x.fail[d.id] || (x.retried && x.retried[d.id] > b.at)); })[0];
            if (!failedIn && M.openErrors(d).length) return;           // not sent: still has errors
            if (!failedIn && !jobs.some(function (x) { return x.type === createType && x.at <= b.at; })) return;
            if (!failedIn) return;
            rows.push(resolveRow({ key: d.key, doc: d, bcNo: '', ext: d.key, customer: M.custMap[d.custKey] || '', bcAmount: null, mtrAmount: d.amount, diff: null, status: 'Missing in Business Central', reason: failedIn.fail[d.id] || 'Request timed out after 60 seconds (created on retry after this file was taken)' }, b));
            return;
          }
          var delta = (b.kind === 'BP' ? diffSO[d.id] : diffCM[d.id]) || 0;
          var corrected = acts['corr|' + d.key] && acts['corr|' + d.key][1] < b.at;
          if (corrected) delta = 0;
          var bcAmt = r2(d.calc + delta);
          var diff = r2(bcAmt - d.amount);
          var status = Math.abs(diff) < 0.005 ? 'Matched' : Math.abs(diff) <= D.TOLERANCE ? 'Matched within Tolerance' : 'Amount Difference';
          rows.push(resolveRow({ key: d.key, doc: d, bcNo: num, ext: d.key, customer: M.custMap[d.custKey], location: (M.gstin(d.gstin) || {}).location || D.MFN.location, bcAmount: bcAmt, mtrAmount: d.amount, diff: diff, status: status, lines: d.lines.length }, b));
        });
        if (b.kind === 'BP' && b.month === '2026-10') rows.push(resolveRow({ key: 'SO-AMZ-2610-T001', doc: null, bcNo: 'SO-AMZ-2610-T001', ext: 'BOM7-TEST-0001', customer: 'AMZB2C-MH', location: 'AMZ-BOM7', bcAmount: 899, mtrAmount: null, diff: null, status: 'Not in MTR', reason: 'Test order created in Business Central' }, b));
      } else if (b.kind === 'AP' || b.kind === 'ACM') {
        var postType = b.kind === 'AP' ? 'Post Sales Orders' : 'Post Sales Credit Memos';
        var pj = jobs.filter(function (j) { return j.type === postType && j.month === b.month && j.at <= b.at; });
        var seen = {};
        pj.forEach(function (j) {
          j.docIds.forEach(function (id) {
            if (seen[id]) return; seen[id] = 1;
            var d = D.doc(id);
            var okNow = !!inJob(postType, id, b.at);
            if (!okNow) { rows.push(resolveRow({ key: d.key, doc: d, bcNo: b.kind === 'AP' ? soNum[id] : cmNum[id], postedNo: '', ext: d.key, bcAmount: null, mtrAmount: d.amount, diff: null, status: 'Not Posted', reason: j.fail[id] || (j.retried && j.retried[id] ? 'Posted on retry after this file was taken' : 'Not posted') }, b)); return; }
            var delta = (b.kind === 'AP' ? diffSO[d.id] : diffCM[d.id]) || 0;
            var acc = acts['accd|' + d.key];
            if (acts['corr|' + d.key]) delta = 0;
            var bcAmt = r2(d.calc + delta), diff = r2(bcAmt - d.amount);
            rows.push(resolveRow({ key: d.key, doc: d, bcNo: b.kind === 'AP' ? soNum[id] : cmNum[id], postedNo: b.kind === 'AP' ? siNum[id] : pcmNum[id], ext: d.key, bcAmount: bcAmt, mtrAmount: d.amount, diff: diff,
              status: Math.abs(diff) <= D.TOLERANCE ? 'Posted and Matched' : acc ? 'Posted, Difference Accepted' : 'Posted with Difference', postedAt: j.at }, b));
          });
        });
      } else if (b.kind === 'BCU') {
        var list = b.base ? D.BC_CUSTOMERS : M.bcCustomers;
        list.forEach(function (c) { rows.push({ key: c.no, cust: c, status: b.base ? 'Saved' : (D.BC_CUSTOMERS_NEXT.indexOf(c) >= 0 ? 'New' : c.byPortal ? 'Confirmed' : 'No Change') }); });
      }
      return rows;
    };
    M.bcSummary = function (b) {
      var rows = M.bcRows(b), s = { rows: rows, total: rows.length, ok: 0, warn: 0, bad: 0, amount: 0 };
      rows.forEach(function (r) {
        s.amount += r.bcAmount || 0;
        if (/^(Matched|Posted and Matched|Difference Accepted|Posted, Difference Accepted|Ignored|Saved|No Change|New|Confirmed)/.test(r.status)) s.ok++;
        else if (/Correction Requested|Matched within/.test(r.status)) s.warn++;
        else s.bad++;
      });
      return s;
    };

    // ---------- document stage ----------
    M.stage = function (d) {
      if (M.excluded(d)) return 'Excluded';
      if (M.netZero(d)) return 'Cancelled in Same Month';
      if (d.type === 'Cancel') { var rq = M.cancelFor(d.ref); return rq ? ({ Cancelled: 'Cancelled in Business Central', 'Sent to API': 'Cancellation in Progress', Failed: 'Cancellation Failed', Queued: 'Cancellation Queued', 'Converted to Credit Memo': 'Credit Memo Instead of Cancellation' }[rq.status] || rq.status) : (d.month !== d.inv.month ? 'Cancellation Required' : 'Cancelled in Same Month'); }
      if (M.openErrors(d).length) return 'Error';
      var isCM = d.type === 'Refund';
      var post = inJob(isCM ? 'Post Sales Credit Memos' : 'Post Sales Orders', d.id);
      if (post) return 'Posted';
      var sentPost = jobs.some(function (j) { return j.type === (isCM ? 'Post Sales Credit Memos' : 'Post Sales Orders') && j.docIds.indexOf(d.id) >= 0; });
      if (sentPost) return 'Posting Failed';
      if (inJob(isCM ? 'Create Sales Credit Memos' : 'Create Sales Orders', d.id)) {
        var bp = M.bcLatest(isCM ? 'BCM' : 'BP', d.month);
        if (bp) { var r = M.bcRows(bp).filter(function (x) { return x.key === d.key; })[0]; if (r) return r.status === 'Amount Difference' ? 'Amount Difference in Business Central' : 'Reconciled in Business Central'; }
        return isCM ? 'Credit Memo Created' : 'Sales Order Created';
      }
      if (jobs.some(function (j) { return j.fail[d.id]; })) return 'Creation Failed';
      return 'Validated';
    };
    M.readyToCreate = function (kind, month) {
      return M.docs.filter(function (d) {
        if (month && d.month !== month) return false;
        if (kind === 'SO' ? !(d.type === 'Shipment' || d.type === 'FreeReplacement') : d.type !== 'Refund') return false;
        if (M.netZero(d) || M.excluded(d) || M.openErrors(d).length) return false;
        var t = kind === 'SO' ? 'Create Sales Orders' : 'Create Sales Credit Memos';
        return !inJob(t, d.id) && !jobs.some(function (j) { return j.type === t && j.fail[d.id]; });
      });
    };
    M.readyToPost = function (kind, month) {
      var b = M.bcLatest(kind === 'SO' ? 'BP' : 'BCM', month);
      if (!b) return [];
      var pt = kind === 'SO' ? 'Post Sales Orders' : 'Post Sales Credit Memos';
      return M.bcRows(b).filter(function (r) { return r.doc && /^(Matched|Difference Accepted)/.test(r.status) && !jobs.some(function (j) { return j.type === pt && j.docIds.indexOf(r.doc.id) >= 0; }); });
    };

    // ---------- cancellation requests ----------
    var cands = D.DOCS.filter(function (d) { return d.type === 'Cancel' && d.month === '2026-10' && d.inv.month === '2026-09' && M.uploaded(d.month, d.report); });
    M.cancelCandidates = cands;
    var reqs = [];
    var baseStat = ['Cancelled', 'Cancelled', 'Cancelled', 'Cancelled', 'Cancelled', 'Cancelled', 'Cancelled', 'Sent to API', 'Sent to API', 'Failed', 'Failed', 'Queued'];
    var reasons = ['Order cancelled by customer after invoicing', 'Order cancelled by Amazon (undeliverable)', 'Order cancelled by customer after invoicing'];
    cands.slice(0, 12).forEach(function (d, i) {
      var p = M.postedInvoiceFor(d.ref);
      var t0 = dt(2026, 11, 5, 12, 15);
      var ev = [['Uploaded', t0, 'FIN', 'Uploaded in CAN-2611-01'], ['Queued', t0 + 60000, 'SYS', 'Waiting for the cancellation API']];
      var s = baseStat[i];
      if (s !== 'Queued') ev.push(['Sent to API', t0 + (5 + i) * 60000, 'SYS', 'POST /api/crestline/v1/cancelPostedInvoice']);
      if (s === 'Cancelled') ev.push(['Cancelled', t0 + (9 + i * 2) * 60000, 'SYS', 'Corrective credit memo ' + 'PSCM-2610-' + pad(2280 + i, 5) + ' posted and applied']);
      if (s === 'Failed') ev.push(['Failed', t0 + (11 + i) * 60000, 'SYS', i === 9 ? 'The posted invoice is applied to a customer payment. Unapply the entries or post a credit memo.' : 'Request timed out after 60 seconds']);
      reqs.push({ id: 'CR-2611-' + pad(i + 1, 4), doc: d, invoiceNo: d.ref, postedNo: p ? p.no : '', reason: reasons[i % 3], batch: 'CAN-2611-01', events: ev, kind: i === 9 ? 'applied' : i === 10 ? 'timeout' : 'normal', base: true });
    });
    (st.cn || []).forEach(function (c) {
      var d = cands.filter(function (x) { return x.ref === c[1]; })[0] || D.DOCS.filter(function (x) { return x.type === 'Shipment' && x.key === c[1]; })[0];
      var p = M.postedInvoiceFor(c[1]);
      reqs.push({ id: c[0], doc: d, invoiceNo: c[1], postedNo: p ? p.no : '', reason: c[2], batch: c[5] || '', events: [['Uploaded', c[3], c[4], 'Uploaded in ' + (c[5] || 'portal')], ['Queued', c[3] + 1000, 'SYS', 'Waiting for the cancellation API']], kind: 'normal', fresh: true });
    });
    var cev = st.cev || {};
    reqs.forEach(function (r) {
      (cev[r.id] || []).forEach(function (e) { r.events.push(e); });
      r.events.sort(function (a, b) { return a[1] - b[1]; });
      var last = r.events[r.events.length - 1];
      r.status = last[0] === 'Retry Requested' ? 'Queued' : last[0];
      r.updated = last[1];
      r.lastNote = last[3];
    });
    M.cancels = reqs.sort(function (a, b) { return b.events[0][1] - a.events[0][1] || (a.id < b.id ? -1 : 1); });
    M.cancel = function (id) { return reqs.filter(function (r) { return r.id === id; })[0]; };
    M.cancelFor = function (inv) { return reqs.filter(function (r) { return r.invoiceNo === inv && r.status !== 'Withdrawn'; })[0]; };
    M.cancelBatches = function () {
      var b = {};
      reqs.forEach(function (r) { if (!b[r.batch]) b[r.batch] = { id: r.batch, at: r.events[0][1], by: r.events[0][2], count: 0 }; b[r.batch].count++; });
      return Object.keys(b).map(function (k) { return b[k]; }).sort(function (a, c) { return c.at - a.at; });
    };

    // ---------- missing customers ----------
    var miss = {};
    M.docs.forEach(function (d) {
      if (d.month !== '2026-10' || D.CUST_MAP_BASE[d.custKey]) return;
      var m = miss[d.custKey] = miss[d.custKey] || { key: d.custKey, docs: [], amount: 0, first: d };
      m.docs.push(d); m.amount += d.amount;
    });
    M.missingCustomers = Object.keys(miss).map(function (k) {
      var m = miss[k], p = k.split('|'), c = cus[k];
      m.kind = p[0];
      m.name = D.custLabel(k);
      m.gstinNo = p[0] === 'B2B' ? p[1] : '';
      m.stateCode = p[0] === 'B2B' ? p[1].slice(0, 2) : p[1];
      m.stateName = D.state(m.stateCode).name;
      m.amount = r2(m.amount);
      m.status = c ? (c[0] === 'N' ? 'Created' : 'Mapped') : 'Missing';
      m.bcNo = c ? c[1] : '';
      m.resolvedAt = c ? c[3] : null; m.resolvedBy = c ? c[4] : null;
      var b = p[0] === 'B2B' ? D.BUYERS.filter(function (x) { return x.gstin === p[1]; })[0] : null;
      m.suggestNo = p[0] === 'B2C' ? 'AMZB2C-' + D.state(p[1]).short : (b && b.bc) || 'C-AMZ-' + pad(101 + D.BUYERS.indexOf(b), 4);
      m.suggestMode = M.bcCustomer(m.suggestNo) ? 'Map to Existing' : 'Create New';
      return m;
    }).sort(function (a, b) { return (a.status === 'Missing' ? 0 : 1) - (b.status === 'Missing' ? 0 : 1) || b.docs.length - a.docs.length; });
    M.resolvedCustomerHistory = [
      { key: 'B2C|04', name: 'Amazon B2C — Chandigarh', kind: 'B2C', bcNo: 'AMZB2C-CH', status: 'Mapped', at: dt(2026, 10, 5, 12, 2), by: 'OPS', docs: 3 },
      { key: 'B2B|' + D.BUYERS[12].gstin, name: D.BUYERS[12].name, kind: 'B2B', bcNo: D.BUYERS[12].bc, status: 'Created', at: dt(2026, 10, 5, 12, 10), by: 'OPS', docs: 2 },
      { key: 'B2C|30', name: 'Amazon B2C — Goa', kind: 'B2C', bcNo: 'AMZB2C-GA', status: 'Mapped', at: dt(2026, 9, 4, 15, 40), by: 'OPS2', docs: 4 }
    ];

    // ---------- reconciliation runs ----------
    M.reconRuns = D.RECON_RUNS.concat((st.rr || []).map(function (r) { return { month: r[0], at: r[1], by: r[2], filters: r[3] || '' }; })).sort(function (a, b) { return b.at - a.at; });
    M.lastRun = function (month) { return M.reconRuns.filter(function (r) { return r.month === month; })[0]; };

    // ---------- users and permissions ----------
    var uedit = st.usr || {};
    M.users = D.USERS.map(function (u) { var o = {}; for (var k in u) o[k] = u[k]; if (uedit[u.id]) for (var j in uedit[u.id]) o[j] = uedit[u.id][j]; return o; });
    (st.nu || []).forEach(function (u) { var o = { id: u[0], name: u[1], role: u[2], email: u[3], phone: u[4] || '', status: 'Invited', last: null, created: u[5], fresh: true }; if (uedit[o.id]) for (var j in uedit[o.id]) o[j] = uedit[o.id][j]; M.users.push(o); });
    M.user = function (id) { return M.users.filter(function (u) { return u.id === id; })[0]; };
    var pov = st.perm || {};
    M.perms = D.PERMS.map(function (p) { var o = { key: p.key, name: p.name, area: p.area, roles: p.roles.slice() }; if (pov[p.key]) o.roles = pov[p.key].split(' ').filter(Boolean); return o; });
    M.can = function (role, key) { var p = M.perms.filter(function (x) { return x.key === key; })[0]; return !!p && p.roles.indexOf(role) >= 0; };

    // ---------- audit ----------
    var base = [
      [dt(2026, 10, 5, 11, 4), 'OPS', 'MTR Uploaded', 'UPL-2609-B2C', 'September 2026 B2C, ' + D.MTR_UPLOADS[0].rows + ' rows'],
      [dt(2026, 10, 5, 11, 12), 'OPS', 'MTR Uploaded', 'UPL-2609-B2B', 'September 2026 B2B, ' + D.MTR_UPLOADS[1].rows + ' rows'],
      [dt(2026, 10, 5, 11, 30), 'OPS', 'Reconciliation Run', 'September 2026', 'All Seller GSTINs, all transaction types'],
      [dt(2026, 10, 5, 12, 2), 'OPS', 'Customer Mapped', 'AMZB2C-CH', 'Amazon B2C — Chandigarh'],
      [dt(2026, 10, 5, 12, 10), 'OPS', 'Customer Created', D.BUYERS[12].bc, D.BUYERS[12].name],
      [dt(2026, 10, 6, 15, 2), 'FIN', 'Job Started', 'JOB-2609-01', 'Create Sales Orders, September 2026'],
      [dt(2026, 10, 6, 17, 10), 'FIN', 'Business Central Upload', 'BP-2609-01', 'Before posting, September 2026'],
      [dt(2026, 10, 7, 11, 15), 'FIN', 'Job Started', 'JOB-2609-03', 'Post Sales Orders, September 2026'],
      [dt(2026, 10, 7, 16, 30), 'FIN', 'Business Central Upload', 'AP-2609-01', 'After posting, September 2026'],
      [dt(2026, 10, 7, 16, 55), 'FIN', 'Business Central Upload', 'ACM-2609-01', 'After credit memo, September 2026'],
      [dt(2026, 11, 1, 10, 20), 'FIN', 'Business Central Upload', 'BCU-2611-01', 'Customer master, ' + D.BC_CUSTOMERS.length + ' customers'],
      [dt(2026, 11, 2, 9, 30), 'ADM', 'User Invited', 'USR-006', 'Farah Khan, Marketplace Operations Executive'],
      [dt(2026, 11, 5, 10, 42), 'OPS', 'MTR Uploaded', 'UPL-2610-B2C', 'October 2026 B2C, ' + D.MTR_UPLOADS[2].rows + ' rows'],
      [dt(2026, 11, 5, 11, 5), 'OPS', 'Reconciliation Run', 'October 2026', 'All Seller GSTINs, all transaction types'],
      [dt(2026, 11, 5, 12, 15), 'FIN', 'Cancellation Requested', 'CAN-2611-01', '12 posted invoices'],
      [dt(2026, 11, 5, 15, 10), 'FIN', 'Job Started', 'JOB-2610-01', 'Create Sales Orders, October 2026'],
      [dt(2026, 11, 5, 16, 5), 'FIN', 'Job Started', 'JOB-2610-02', 'Create Sales Credit Memos, October 2026'],
      [dt(2026, 11, 5, 17, 32), 'FIN', 'Business Central Upload', 'BP-2610-01', 'Before posting, October 2026'],
      [dt(2026, 11, 5, 18, 4), 'FIN', 'Business Central Upload', 'BCM-2610-01', 'Before credit memo, October 2026'],
      [dt(2026, 11, 6, 9, 12), 'ADM', 'Signed In', 'USR-001', 'Rohit Bansal'],
      [dt(2026, 11, 6, 9, 40), 'OPS', 'Signed In', 'USR-002', 'Sneha Patil'],
      [dt(2026, 11, 6, 9, 55), 'FIN', 'Signed In', 'USR-003', 'Karan Mehta']
    ];
    M.audit = base.map(function (a, i) { return { at: a[0], by: a[1], action: a[2], ref: a[3], detail: a[4], id: 'A' + i }; })
      .concat(lg.map(function (a, i) { return { at: a[0], by: a[1], action: a[2], ref: a[3], detail: a[4], id: 'S' + i, fresh: true }; }))
      .sort(function (a, b) { return b.at - a.at; });

    // ---------- notifications ----------
    var openH = errs.filter(function (e) { return e.status === 'Open'; }).length, openI = items.filter(function (e) { return e.status === 'Open'; }).length;
    var unm = M.listings.filter(function (l) { return !l.item && M.docs.some(function (d) { return d.lines.some(function (x) { return x.sku === l.sku; }); }); }).length;
    var nt = [
      { id: 'N1', at: dt(2026, 11, 5, 10, 44), kind: 'ok', title: 'October 2026 B2C MTR saved', text: D.MTR_UPLOADS[2].rows + ' rows saved from ' + D.MTR_UPLOADS[2].file, link: 'AOP-MTR-02', q: 'id=UPL-2610-B2C', roles: 'ADM OPS FIN' },
      { id: 'N2', at: dt(2026, 11, 5, 11, 6), kind: 'warn', title: 'Reconciliation found errors in October 2026', text: openH + ' header errors and ' + openI + ' item errors are open', link: 'AOP-MTR-05', roles: 'ADM OPS FIN' },
      { id: 'N3', at: dt(2026, 11, 5, 11, 6), kind: 'warn', title: 'Amazon SKUs without a Business Central item', text: unm + ' SKUs in the October MTR have no mapping', link: 'AOP-MAP-01', roles: 'ADM OPS' },
      { id: 'N4', at: dt(2026, 11, 5, 12, 28), kind: 'bad', title: 'Cancellation request failed', text: 'CR-2611-0010: the posted invoice is applied to a customer payment', link: 'AOP-CAN-02', q: 'id=CR-2611-0010', roles: 'ADM FIN' },
      { id: 'N5', at: dt(2026, 11, 5, 15, 19), kind: 'warn', title: 'JOB-2610-01 finished with failures', text: '2 sales orders were not created: request timed out', link: 'AOP-INT-02', q: 'id=JOB-2610-01', roles: 'ADM FIN OPS' },
      { id: 'N6', at: dt(2026, 11, 5, 17, 33), kind: 'warn', title: 'Before posting reconciliation for October 2026', text: 'Amount differences and missing orders need review', link: 'AOP-BC-05', q: 'id=BP-2610-01', roles: 'ADM FIN' },
      { id: 'N7', at: dt(2026, 11, 6, 9, 0), kind: 'blue', title: 'October 2026 B2B MTR is available', text: 'Download it from Amazon Seller Central and upload it', link: 'AOP-MTR-01', roles: 'ADM OPS' },
      { id: 'N8', at: dt(2026, 11, 3, 14, 10), kind: 'blue', title: 'New Seller GSTIN on Amazon', text: 'MAA4 Sriperumbudur (33AAHCC4821K1Z4) started shipping on 20 October', link: 'AOP-SET-01', roles: 'ADM OPS' }
    ];
    (st.nt || []).forEach(function (n, i) { nt.push({ id: 'S' + i, at: n[0], kind: n[1], title: n[2], text: n[3], link: n[4], q: n[5] || '', roles: n[6] || 'ADM OPS FIN', fresh: true }); });
    var read = st.n || [];
    M.notifications = nt.map(function (n) { n.read = read.indexOf(n.id) >= 0; return n; }).sort(function (a, b) { return b.at - a.at; });

    return M;
  };
})();
