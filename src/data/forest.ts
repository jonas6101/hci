import type { Grove, TreeData } from '../lib/types';

/**
 * Past conversations — the rest of the user's forest.
 * Leaf notation: "Label|y" = your thinking, "|t" = together, "|a" = delegated to AI.
 */

export const GROVES: Grove[] = [
  { id: 'cs', label: 'Computer science' },
  { id: 'stats', label: 'Statistics' },
  { id: 'hci', label: 'HCI' },
  { id: 'writing', label: 'Writing' },
  { id: 'life', label: 'Everyday' },
];

/** Groves are laid out in rows on the forest canvas. */
export const GROVE_ROWS = [
  ['cs', 'stats'],
  ['hci', 'writing', 'life'],
];

const SCORE = { y: 1, t: 0.5, a: 0 } as const;

function tree(id: string, title: string, grove: string, updated: string, spec: Record<string, string[]>): TreeData {
  return {
    id,
    title,
    grove,
    updated,
    branches: Object.entries(spec).map(([label, leaves], bi) => ({
      id: `${id}-b${bi}`,
      label,
      leaves: leaves.map((l, li) => {
        const [name, s] = l.split('|') as [string, keyof typeof SCORE];
        return { id: `${id}-b${bi}-l${li}`, label: name, score: SCORE[s] ?? 0 };
      }),
    })),
  };
}

export const PAST_TREES: TreeData[] = [
  tree('sql', 'SQL joins', 'cs', 'Oct 28', {
    'Join types': ['Inner join|y', 'Left join|y', 'Full outer join|t', 'Self join|a'],
    Performance: ['Hash tables|a', 'Indexes|t', 'Query plans|a'],
  }),
  tree('git', 'Git branching', 'cs', 'Oct 3', {
    Basics: ['Commits|y', 'Branches|y'],
    Merging: ['Merge conflicts|t', 'Rebase|a', 'Fast-forward|y'],
    Collaboration: ['Pull requests|t'],
  }),
  tree('bigo', 'Big-O notation', 'cs', 'Sep 21', {
    Complexity: ['Time complexity|y', 'Space complexity|t', 'Worst case|y'],
    'Data structures': ['Hash tables|t', 'Binary search|y', 'Linked lists|a'],
  }),
  tree('hyp', 'Hypothesis testing', 'stats', 'Nov 2', {
    'Core ideas': ['Null hypothesis|y', 'p-value|t', 'Significance level|t'],
    Errors: ['Type I error|a', 'Type II error|a'],
    Design: ['Sample size|t', 'Conditional probability|a'],
  }),
  tree('bayes', 'Bayes’ theorem', 'stats', 'Oct 19', {
    Foundations: ['Conditional probability|y', 'Prior|y', 'Posterior|t'],
    Applications: ['Medical tests|y', 'Spam filters|t'],
  }),
  tree('reg', 'Linear regression', 'stats', 'Oct 8', {
    Model: ['Least squares|t', 'Coefficients|a', 'Residuals|a'],
    Fitting: ['Gradient descent|a', 'Loss function|a'],
    Pitfalls: ['Overfitting|t', 'Multicollinearity|a'],
  }),
  tree('nielsen', 'Nielsen’s heuristics', 'hci', 'Nov 5', {
    Heuristics: ['Visibility of status|y', 'Recognition over recall|y', 'Error prevention|t', 'User control|y'],
    Method: ['Heuristic evaluation|t', 'Severity ratings|a'],
  }),
  tree('ut', 'Usability testing', 'hci', 'Oct 30', {
    Planning: ['Tasks & scenarios|y', 'Sample size|t', 'Recruiting|a'],
    Running: ['Think-aloud|y', 'Moderation|t'],
    Analysis: ['Heuristic evaluation|a', 'SUS score|a'],
  }),
  tree('mm', 'Mental models', 'hci', 'Oct 14', {
    Concepts: ['Gulf of execution|y', 'Gulf of evaluation|y', 'Affordances|t'],
    Design: ['Recognition over recall|t', 'Conceptual models|y'],
  }),
  tree('essay', 'Essay structure', 'writing', 'Sep 30', {
    Shape: ['Thesis statement|y', 'Opening hook|t', 'Signposting|y'],
    Argument: ['Counterarguments|t', 'Evidence|y'],
  }),
  tree('cover', 'Cover letter', 'writing', 'Nov 1', {
    Draft: ['Opening hook|a', 'Tone|a', 'Company research|a'],
    Polish: ['Length|a', 'Call to action|a'],
  }),
  tree('bread', 'Sourdough baking', 'life', 'Oct 22', {
    Starter: ['Feeding ratio|y', 'Fermentation|t'],
    Bake: ['Hydration|y', 'Scoring|y', 'Oven spring|t'],
  }),
  tree('lisbon', 'Lisbon trip', 'life', 'Oct 10', {
    Plan: ['Itinerary|a', 'Neighbourhoods|a', 'Day trips|a'],
    Money: ['Daily budget|t'],
  }),
  tree('budget', 'Budgeting basics', 'life', 'Sep 15', {
    Rules: ['50/30/20 rule|y', 'Emergency fund|t', 'Daily budget|y'],
    Tools: ['Spreadsheets|t', 'Index funds|a'],
  }),
];

/** Order of chats in the host app's sidebar. */
export const HOST_HISTORY: { label: string; items: string[] }[] = [
  { label: 'Today', items: ['nn'] },
  { label: 'This week', items: ['nielsen', 'hyp', 'cover', 'ut'] },
  { label: 'Earlier', items: ['sql', 'bread', 'bayes', 'mm', 'lisbon', 'reg', 'git', 'essay', 'bigo', 'budget'] },
];
