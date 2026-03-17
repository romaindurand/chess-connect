/** @type {import('i18n-unused').RunOptions} */
module.exports = {
  localesPath: 'src/lib/i18n',
  localesExtensions: ['json'],
  srcPath: 'src',
  srcExtensions: ['js', 'ts', 'svelte'],
  ignorePaths: ['src/lib/server/ai', 'build', 'node_modules'],
  // Match any quoted i18n key literal used in source files.
  translationKeyMatcher: /['"](?:meta|common|language|home|game|options|piece|errors)\.[^'"]+['"]/g,
  missedTranslationParser: (value) => {
    const match = value.match(/['"`]([^'"`]+)['"`]/);
    return match ? match[1] : value;
  },
  // Baseline exclusions for non-actionable checks in this project.
  excludeKey: ['meta.siteName', 'piece.']
};
