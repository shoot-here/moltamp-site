-- Add html_content column for live iframe previews
-- Stores the widget's index.html content for rendering in sandboxed iframes
-- Run: wrangler d1 execute moltamp-db --local --file=migrations/0006_widget_html_preview.sql

ALTER TABLE community_widgets ADD COLUMN html_content TEXT;
