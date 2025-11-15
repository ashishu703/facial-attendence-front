// Strip HTML tags and convert to plain text
export const stripHtml = (html: string): string => {
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  
  // Get text content and clean up
  let text = tmp.textContent || tmp.innerText || '';
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  
  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
};

// Template placeholder replacement utility
export const replacePlaceholders = (template: string, data: Record<string, string | number>): string => {
  if (!template) return '';
  
  let result = template;
  
  const placeholders: Record<string, string> = {
    '{{name}}': String(data.name || 'John Doe'),
    '{{code}}': String(data.code || 'EMP001'),
    '{{date}}': String(data.date || new Date().toLocaleDateString('en-IN')),
    '{{time}}': String(data.time || new Date().toLocaleTimeString('en-IN')),
    '{{in_time}}': String(data.in_time || '09:00:00 AM'),
    '{{out_time}}': String(data.out_time || '06:00:00 PM'),
    '{{total_hours}}': String(data.total_hours || '9.0'),
    '{{organization}}': String(data.organization || 'Sample Organization'),
    '{{status}}': String(data.status || 'checked_in'),
  };

  Object.keys(placeholders).forEach(key => {
    const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
    result = result.replace(regex, placeholders[key]);
  });

  return result;
};

// Sample data for preview
export const getSampleData = () => ({
  name: 'John Doe',
  code: 'EMP001',
  date: new Date().toLocaleDateString('en-IN'),
  time: new Date().toLocaleTimeString('en-IN'),
  in_time: '09:00:00 AM',
  out_time: '06:00:00 PM',
  total_hours: '9.0',
  organization: 'Sample Organization',
  status: 'checked_in',
});

