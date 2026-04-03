/**
 * Shared widget card renderer.
 * Used by gallery grid. Text-based cards (no color preview like skins).
 */

function renderWidgetCard(widget) {
  // Star rating display
  const avg = widget.avg_rating || 0;
  const count = widget.rating_count || 0;
  const rounded = Math.round(avg);
  let starsHtml = '';
  if (count > 0) {
    for (let i = 1; i <= 5; i++) {
      const filled = i <= rounded;
      starsHtml += '<svg width="10" height="10" viewBox="0 0 24 24" fill="' + (filled ? '#fbbf24' : 'none') + '" stroke="#fbbf24" stroke-width="2" style="vertical-align:middle;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    }
    starsHtml += '<span style="font-size:0.6rem;margin-left:2px;opacity:0.8;">' + avg + '</span>';
  }

  const tags = widget.tags && widget.tags.length > 0
    ? '<div class="wc-tags">' + widget.tags.slice(0, 3).map(function(t) { return '<span class="wc-tag">' + t + '</span>'; }).join('') + '</div>'
    : '';

  const size = (widget.file_size / 1024).toFixed(0);

  return '<a href="/widgets/view?id=' + widget.widget_id + '" class="widget-card">' +
    '<div class="wc-icon">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>' +
    '</div>' +
    '<div class="wc-body">' +
      '<h3 class="wc-name">' + widget.name + '</h3>' +
      '<p class="wc-author">by ' + widget.author_name + '</p>' +
      '<p class="wc-desc">' + (widget.description || 'No description') + '</p>' +
      tags +
    '</div>' +
    '<div class="wc-footer">' +
      '<span class="wc-meta">' + widget.download_count + ' dl' + (widget.download_count !== 1 ? 's' : '') + '</span>' +
      '<span class="wc-meta">' + size + ' KB</span>' +
      (starsHtml ? '<span class="wc-stars">' + starsHtml + '</span>' : '') +
    '</div>' +
  '</a>';
}
