import { htmlToText } from 'html-to-text';

export interface TextFormattingOptions {
  maxWidth?: number;
  preserveLinks?: boolean;
}

/**
 * Formats HTML text for terminal display
 */
export function formatTextForTerminal(text: string, options: TextFormattingOptions = {}): string {
  const {
    maxWidth = 80,
    preserveLinks = true
  } = options;

  if (!text || typeof text !== 'string') {
    return '';
  }

  // Convert HTML to text with better structure preservation
  const htmlToTextOptions = {
    wordwrap: maxWidth,
    preserveNewlines: true,
    selectors: [
      { selector: 'a', format: 'anchor' }
    ],
    formatters: {
      anchor: (elem: any, _walk: any, builder: any) => {
        const href = elem.attribs?.href;
        const text = elem.children?.[0]?.data || href;
        if (preserveLinks && href) {
          builder.addInline(`${text} (${href})`);
        } else {
          builder.addInline(text);
        }
      }
    }
  };

  try {
    const formattedText = htmlToText(text, htmlToTextOptions);
    
    // Clean up any excessive whitespace while preserving structure
    return formattedText
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
      .trim();
  } catch (error) {
    // If HTML parsing fails, fall back to original text
    console.warn('Failed to parse HTML, using original text:', error);
    return text.trim();
  }
}

/**
 * Formats annotation body text specifically for terminal display
 */
export function formatAnnotationBody(bodyText: string, options: TextFormattingOptions = {}): string {
  return formatTextForTerminal(bodyText, {
    maxWidth: 100,
    preserveLinks: true,
    ...options
  });
}
