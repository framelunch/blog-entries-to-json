#!/usr/bin/env node

/*
 * --- scripts sample
 * "md": "node modules/md2json.js --overview-length 100 --entry-dir entries --summary-path src/static/parties.json --detail-path src/static/parties",
 * "dev:md": "npm run md -- -w -f",
 *
 * --- add layouts/default.vue
 * <style lang="postcss">
 * @import 'prismjs/themes/prism-okaidia.css';
 * </style>
 */

import fs from 'fs';
import path from 'path';
import program from 'commander';
import chalk from 'chalk';
import chokidar from 'chokidar';
import mkdirp from 'mkdirp';
import globby from 'globby';
import md from 'markdown-it';
import mdFrontmatter from 'markdown-it-front-matter';
import mdPrism from 'markdown-it-prism';
import yamljs from 'yamljs';
import { JSDOM } from 'jsdom';
import { minify } from 'html-minifier';

const { document } = new JSDOM().window;

interface FrontMatter {
  title: string;
  draft: boolean;
  thumbnail?: string;
  tags?: string[];
  category?: string;
}

interface Detail extends FrontMatter {
  date: string;
  html: string;
  overview: string;
}

interface ParsedDetail {
  date: string;
  html: string;
  title: string;
  tags?: string[];
  category?: string;
}

/*
 * set commandline options
 */
program
  .version('0.0.1')
  .option('-w, --watch', 'Watch mode enable?')
  .option('-f, --force', 'Output draft files.')
  .option('--overview-length <n>', 'Overview text length.', 10)
  .option('--entry-dir [value]', 'Entries directory.', 'entries')
  .option('--summary-path [value]', 'Summary json output fullpath.', path.join('src', 'static', 'summary.json'))
  .option('--detail-path [value]', 'Detail json output path.', path.join('src', 'static', 'entries'))
  .parse(process.argv);

/*
 * set global configs
 */
const OVERVIEW_LENGTH: number = program.overviewLength;
const ENTRIES_PATH: string = path.join(process.cwd(), program.entryDir);
const SUMMARY_PATH: string = path.join(process.cwd(), program.summaryPath);
const DETAIL_PATH: string = path.join(process.cwd(), program.detailPath);

/*
 * functions
 */
function getEntryInfo(date: string) {
  return getCompiledData(path.join(ENTRIES_PATH, `${date}.md`));
}

function getCompiledData(filepath: string) {
  let head = {};
  const renderer = md()
    .use(mdFrontmatter, (yaml: string) => {
      head = yamljs.parse(yaml) as FrontMatter;
    })
    .use(mdPrism);
  const source = fs.readFileSync(filepath, 'utf8');
  const html = minify(renderer.render(source).trim(), { collapseWhitespace: true });

  return { html, ...(head as FrontMatter) };
}

function getOverview(source: string) {
  return source.length <= OVERVIEW_LENGTH ? source : `${source.substring(0, OVERVIEW_LENGTH)}…`;
}

function outputSummary(source: Detail[]) {
  const data = source.map(({ date, overview, title, tags, category, thumbnail }) => ({
    date,
    overview,
    title,
    tags,
    category,
    thumbnail,
  }));
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(data));
  console.log(`${chalk.bgBlue('OUTPUT SUMMARY')} ${SUMMARY_PATH}`);
}

function parseOutputData({ date, html, title, tags, category }: Detail) {
  return { date, html, title, tags, category };
}

function outputDetail(data: ParsedDetail) {
  fs.writeFileSync(path.join(DETAIL_PATH, `${data.date}.json`), JSON.stringify(data));
  console.log(`${chalk.bgGreen('OUTPUT DETAIL')} ${path.join(DETAIL_PATH, `${data.date}.json`)}`);
}

function outputDetails(source: Detail[]) {
  mkdirp.sync(DETAIL_PATH);
  source.map(parseOutputData).forEach(outputDetail);
}

function getJsonData({ from: date }: { from: string }): Detail {
  const info = getEntryInfo(date);
  const div = document.createElement('div');
  div.innerHTML = info.html;
  const textContent = div.textContent || '';
  return { date, overview: getOverview(textContent.trim().replace(/\n/, ' ')), ...info };
}

function getPostsData() {
  const sources = globby.sync(path.join(ENTRIES_PATH, '*.md'));
  return sources
    .map(source => path.basename(source, '.md'))
    .reverse()
    .map(date => getJsonData({ from: date }))
    .filter(({ draft }) => program.force || !draft);
}

function main() {
  const allPostsDate = getPostsData();
  outputSummary(allPostsDate);
  outputDetails(allPostsDate);
}

/*
 * run
 */
main();

if (program.watch) {
  console.log(`\n${chalk.bgYellow('WATCH')} ${ENTRIES_PATH}\n`);
  chokidar.watch(ENTRIES_PATH, { ignoreInitial: true }).on('all', (event, changePath) => {
    const allPostsDate = getPostsData();
    const date = path.basename(changePath, '.md');
    console.log(`${chalk.bgMagenta(event)} ${changePath}`);

    outputSummary(allPostsDate);
    const detail = getJsonData({ from: date });
    outputDetail(parseOutputData(detail));
    console.log('');
  });
}
