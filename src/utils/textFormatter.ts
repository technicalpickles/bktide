import { htmlToText } from 'html-to-text';
import { marked } from 'marked';
// @ts-ignore - marked-terminal doesn't have proper types
import TerminalRenderer from 'marked-terminal';

// Configure marked to use terminal renderer
marked.use(new TerminalRenderer({
  // Customize the terminal renderer options
  showSectionPrefix: false,
  tab: 2,
  emoji: true,
  strong: 'bold',
  em: 'italic',
  codespan: 'green',
  del: 'dim',
  link: 'cyan',
  href: 'underline'
}));

export interface TextFormattingOptions {
  maxWidth?: number;
  preserveLinks?: boolean;
  preserveFormatting?: boolean;
}

/**
 * Formats text that may contain HTML and/or markdown for terminal display
 */
export function formatTextForTerminal(text: string, options: TextFormattingOptions = {}): string {
  const {
    maxWidth = 80,
    preserveLinks = true,
    preserveFormatting = true
  } = options;

  if (!text || typeof text !== 'string') {
    return '';
  }

  // First, try to detect if the content is primarily HTML or markdown
  const hasHtmlTags = /<[^>]+>/.test(text);
  const hasMarkdown = /^[#*\-`\[\]]/m.test(text) || /\*\*.*\*\*|__.*__|`.*`|\[.*\]\(.*\)/.test(text);
  
  // If we have both HTML and markdown, prioritize HTML processing first
  const shouldProcessAsHtml = hasHtmlTags;
  const shouldProcessAsMarkdown = hasMarkdown && !shouldProcessAsHtml;

  let formattedText = text;

  if (shouldProcessAsHtml) {
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
      formattedText = htmlToText(text, htmlToTextOptions);
    } catch (error) {
      // If HTML parsing fails, fall back to original text
      console.warn('Failed to parse HTML, using original text:', error);
    }
  } else if (shouldProcessAsMarkdown && preserveFormatting) {
    // Apply markdown formatting to the text
    try {
      const result = marked(formattedText);
      // marked can return a Promise in newer versions, so handle both cases
      if (typeof result === 'string') {
        formattedText = result;
      } else {
        // If it's a Promise, we'll need to handle it differently
        // For now, just use the original text
        console.warn('Marked returned a Promise, using original text');
      }
    } catch (error) {
      // If markdown parsing fails, keep the text as is
      console.warn('Failed to parse markdown, using text as-is:', error);
    }
  }

  // Clean up any excessive whitespace while preserving structure
  formattedText = formattedText
    .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
    .trim();

  return formattedText;
}

/**
 * Formats annotation body text specifically for terminal display
 */
export function formatAnnotationBody(bodyText: string, options: TextFormattingOptions = {}): string {
  return formatTextForTerminal(bodyText, {
    maxWidth: 100,
    preserveLinks: true,
    preserveFormatting: true,
    ...options
  });
}
