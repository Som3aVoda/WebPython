(() => {
  const adminFilter = document.getElementById('adminFilter');
  if (adminFilter) adminFilter.addEventListener('input', () => {
    const q = adminFilter.value.trim().toLowerCase();
    document.querySelectorAll('#adminRows tr').forEach(row => {
      row.hidden = !row.dataset.title.includes(q);
    });
  });

  const relationshipSearch = document.getElementById('relationshipSearch');
  const relationshipList = document.getElementById('relationshipList');
  const relationshipCount = document.getElementById('relationshipCount');
  if (relationshipList) {
    const updateCount = () => {
      const count = relationshipList.querySelectorAll('input[type="checkbox"]:checked').length;
      relationshipCount.textContent = `${count} selected`;
    };
    relationshipList.addEventListener('change', updateCount);
    relationshipSearch?.addEventListener('input', () => {
      const q = relationshipSearch.value.trim().toLowerCase();
      relationshipList.querySelectorAll('.relationship-option').forEach(item => {
        item.hidden = !item.dataset.title.includes(q);
      });
    });
    updateCount();
  }
})();
