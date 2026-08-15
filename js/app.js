'use strict';

/*
 * みんかぶの銘柄スクリーニングに渡す条件を組み立てるだけのアプリ。
 * 株価データは一切取得・保存しない(みんかぶ利用規約 第7条(18)スクレイピング /
 * (19)コンテンツの蓄積 に触れないための設計上の制約。ここは越えないこと)。
 */

var BASE = 'https://minkabu.jp/stock/search';

/*
 * みんかぶスクリーナーのパラメータ(2026-08-15 実機検証済み)。
 * 配列は [下限, 上限]。'min' / 'max' が使える。
 * 単位: market_capitalization = 億円 / minimum_purchase_price = 万円
 */
var STYLES = {
  income: {
    label: '配当でコツコツ',
    sort: 'dividend_yield',
    params: { per: ['min', 10], dividend_yield: [4.2, 'max'], payout_ratio: ['min', 40] },
    desc: [
      ['PER', '10倍以下 — 利益の10年分までしか払わない、という意味'],
      ['配当利回り', '4.2%以上 — 100万円ぶん買うと年4.2万円以上'],
      ['配当性向', '40%以下 — 利益の4割までしか配当に回していない(無理をしていない)']
    ]
  },
  growth: {
    label: '値上がり狙い',
    sort: 'sales_cagr_3y',
    params: { per: ['min', 18], sales_cagr_3y: [10, 'max'], operating_income_margin: [10, 'max'] },
    desc: [
      ['PER', '18倍以下 — 成長するぶん、多少割高でも許容する水準'],
      ['売上の伸び', '3年平均で年10%以上'],
      ['営業利益率', '10%以上 — 売上をきちんと利益に変えている']
    ]
  },
  yutai: {
    label: '株主優待',
    sort: 'dividend_yield',
    params: { yutai_exist: 1, dividend_yield: [2.4, 'max'], per: ['min', 16], eps: [0, 'max'] },
    desc: [
      ['株主優待', 'あり'],
      ['配当利回り', '2.4%以上 — 優待と合わせて総利回り4%台を狙う'],
      ['PER', '16倍以下'],
      ['1株あたり利益', 'プラス — 赤字の会社を外す']
    ]
  }
};

var SIZES = {
  large: { params: { market_capitalization: [2000, 'max'] }, desc: ['会社の大きさ', '時価総額2,000億円以上'] },
  mid:   { params: { market_capitalization: [300, 'max'] },  desc: ['会社の大きさ', '時価総額300億円以上'] },
  any:   { params: {},                                       desc: ['会社の大きさ', '指定なし'] }
};

function checked(name) {
  var el = document.querySelector('input[name="' + name + '"]:checked');
  return el ? el.value : null;
}

function buildUrl(params, sortKey) {
  var parts = ['view=result', 'page=1', 'sort_key=' + sortKey, 'order=desc'];
  Object.keys(params).forEach(function (k) {
    var v = params[k];
    if (Array.isArray(v)) {
      parts.push(k + '[0]=' + v[0]);
      parts.push(k + '[1]=' + v[1]);
    } else {
      parts.push(k + '=' + v);
    }
  });
  return BASE + '?' + parts.join('&');
}

function render() {
  var style = STYLES[checked('style')];
  var sizeKey = checked('size');
  var size = SIZES[sizeKey];
  var budget = checked('budget');
  var safe = document.getElementById('opt-safe').checked;
  var renzoku = document.getElementById('opt-renzoku').checked;

  var params = {};
  Object.keys(style.params).forEach(function (k) { params[k] = style.params[k]; });
  Object.keys(size.params).forEach(function (k) { params[k] = size.params[k]; });
  if (budget !== '0') params.minimum_purchase_price = ['min', Number(budget)];
  if (safe) params.capital_adequacy_ratio = [40, 'max'];
  if (renzoku) params.consecutive_increased_dividend_count = [5, 'max'];

  var url = buildUrl(params, style.sort);

  // 条件の一覧
  var rows = style.desc.slice();
  rows.push(size.desc);
  if (budget !== '0') rows.push(['予算', '1銘柄あたり ' + budget + '万円くらいまで']);
  if (safe) rows.push(['財務の健全性', '自己資本比率40%以上']);
  if (renzoku) rows.push(['連続増配', '5年以上']);

  var dl = document.getElementById('cond-list');
  dl.textContent = '';
  rows.forEach(function (r) {
    var dt = document.createElement('dt');
    dt.textContent = r[0];
    var dd = document.createElement('dd');
    dd.textContent = r[1];
    dl.appendChild(dt);
    dl.appendChild(dd);
  });

  // 注意書き
  var wb = document.getElementById('warn-box');
  wb.textContent = '';
  if (sizeKey === 'any') {
    wb.appendChild(makeWarn(
      '小さい会社ばかりが並びます',
      '同じ条件で実際に試したところ、104件のうちほとんどが時価総額 数十億〜数百億円の会社で、' +
      '不動産・建設に大きく偏っていました。時価総額2,000億円以上に絞ると3件しか残りません。' +
      'また、安く放置されているのには「売買が少なく、大きな資金が入ってこない」という理由があることも多く、' +
      'その場合は売りたいときに売りにくくなります。数字が条件に合っていても、' +
      'なぜ安いのかは決算資料などで別途ご確認ください。'
    ));
  }
  if (renzoku) {
    wb.appendChild(makeWarn(
      '0件になりやすい条件です',
      '「配当を5年以上増やし続けている」は該当がかなり絞られます。結果が出ないときは、まずこのチェックを外してみてください。'
    ));
  }

  var link = document.getElementById('go-link');
  link.href = url;
  document.getElementById('url-out').textContent = url;
}

function makeWarn(title, body) {
  var div = document.createElement('div');
  div.className = 'warn';
  var b = document.createElement('b');
  b.textContent = title;
  div.appendChild(b);
  div.appendChild(document.createTextNode(body));
  return div;
}

function initCopy() {
  var btn = document.getElementById('copy-btn');
  btn.addEventListener('click', function () {
    var text = document.getElementById('url-out').textContent;
    var done = function (msg) {
      btn.textContent = msg;
      setTimeout(function () { btn.textContent = 'URLをコピー'; }, 2200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        done('コピーしました');
      }).catch(function () {
        selectUrl(); done('選択しました(Ctrl+Cでコピー)');
      });
    } else {
      selectUrl(); done('選択しました(Ctrl+Cでコピー)');
    }
  });
}

function selectUrl() {
  var node = document.getElementById('url-out');
  var range = document.createRange();
  range.selectNodeContents(node);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

document.addEventListener('DOMContentLoaded', function () {
  var inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
  Array.prototype.forEach.call(inputs, function (el) {
    el.addEventListener('change', render);
  });
  initCopy();
  render();
});
