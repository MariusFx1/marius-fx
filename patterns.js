/* MS Prime: quiz „Ce pattern e acesta?” (patternuri.html) */
(function () {
  const quiz = document.getElementById('quiz-patternuri');
  if (!quiz) return;
  const items = [...quiz.querySelectorAll('.pq-item')];
  const out = quiz.querySelector('.pq-n');
  const score = () => { out.textContent = items.filter(i => i.dataset.res === '1').length; };
  items.forEach(item => {
    item.querySelectorAll('.pq-opt').forEach(btn => btn.addEventListener('click', () => {
      if (item.dataset.res) return;
      const ok = btn.dataset.ok === '1';
      item.dataset.res = ok ? '1' : '0';
      item.querySelectorAll('.pq-opt').forEach(b => {
        b.disabled = true;
        if (b.dataset.ok === '1') b.classList.add('is-right');
      });
      if (!ok) btn.classList.add('is-wrong');
      item.querySelector(ok ? '.pq-yes' : '.pq-no').hidden = false;
      score();
    }));
  });
  quiz.querySelector('.pq-reset').addEventListener('click', () => {
    items.forEach(item => {
      delete item.dataset.res;
      item.querySelectorAll('.pq-opt').forEach(b => { b.disabled = false; b.classList.remove('is-right', 'is-wrong'); });
      item.querySelectorAll('.pq-fb').forEach(p => { p.hidden = true; });
    });
    score();
    items[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();
