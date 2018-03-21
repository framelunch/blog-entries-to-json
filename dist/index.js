#!/usr/bin/env node
"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var commander_1 = __importDefault(require("commander"));
var chalk_1 = __importDefault(require("chalk"));
var chokidar_1 = __importDefault(require("chokidar"));
var mkdirp_1 = __importDefault(require("mkdirp"));
var globby_1 = __importDefault(require("globby"));
var markdown_it_1 = __importDefault(require("markdown-it"));
var markdown_it_front_matter_1 = __importDefault(require("markdown-it-front-matter"));
var markdown_it_prism_1 = __importDefault(require("markdown-it-prism"));
var yamljs_1 = __importDefault(require("yamljs"));
var jsdom_1 = require("jsdom");
var html_minifier_1 = require("html-minifier");
var document = new jsdom_1.JSDOM().window.document;
commander_1.default
    .version('0.0.1')
    .option('-w, --watch', 'Watch mode enable?')
    .option('-f, --force', 'Output draft files.')
    .option('--overview-length <n>', 'Overview text length.', 10)
    .option('--entry-dir [value]', 'Entries directory.', 'entries')
    .option('--summary-path [value]', 'Summary json output fullpath.', path_1.default.join('src', 'static', 'summary.json'))
    .option('--detail-path [value]', 'Detail json output path.', path_1.default.join('src', 'static', 'entries'))
    .parse(process.argv);
var OVERVIEW_LENGTH = commander_1.default.overviewLength;
var ENTRIES_PATH = path_1.default.join(process.cwd(), commander_1.default.entryDir);
var SUMMARY_PATH = path_1.default.join(process.cwd(), commander_1.default.summaryPath);
var DETAIL_PATH = path_1.default.join(process.cwd(), commander_1.default.detailPath);
function getEntryInfo(date) {
    return getCompiledData(path_1.default.join(ENTRIES_PATH, date + ".md"));
}
function getCompiledData(filepath) {
    var head = {};
    var renderer = markdown_it_1.default()
        .use(markdown_it_front_matter_1.default, function (yaml) {
        head = yamljs_1.default.parse(yaml);
    })
        .use(markdown_it_prism_1.default);
    var source = fs_1.default.readFileSync(filepath, 'utf8');
    var html = html_minifier_1.minify(renderer.render(source).trim(), { collapseWhitespace: true });
    return __assign({ html: html }, head);
}
function getOverview(source) {
    return source.length <= OVERVIEW_LENGTH ? source : source.substring(0, OVERVIEW_LENGTH) + "\u2026";
}
function outputSummary(details) {
    mkdirp_1.default.sync(path_1.default.dirname(SUMMARY_PATH));
    var data = details.map(function (detail) {
        return Object.keys(detail)
            .filter(function (key) { return key !== 'html'; })
            .reduce(function (tmp, key) {
            tmp[key] = detail[key];
            return tmp;
        }, {});
    });
    fs_1.default.writeFileSync(SUMMARY_PATH, JSON.stringify(data));
    console.log(chalk_1.default.bgBlue('OUTPUT SUMMARY') + " " + SUMMARY_PATH);
}
function outputDetail(data) {
    fs_1.default.writeFileSync(path_1.default.join(DETAIL_PATH, data.date + ".json"), JSON.stringify(data));
    console.log(chalk_1.default.bgGreen('OUTPUT DETAIL') + " " + path_1.default.join(DETAIL_PATH, data.date + ".json"));
}
function outputDetails(source) {
    mkdirp_1.default.sync(DETAIL_PATH);
    source.forEach(outputDetail);
}
function getJsonData(_a) {
    var date = _a.from;
    var info = getEntryInfo(date);
    var div = document.createElement('div');
    div.innerHTML = info.html;
    var textContent = div.textContent || '';
    return __assign({ date: date, overview: getOverview(textContent.trim().replace(/\n/, ' ')) }, info);
}
function getPostsData() {
    var sources = globby_1.default.sync(path_1.default.join(ENTRIES_PATH, '*.md'));
    return sources
        .map(function (source) { return path_1.default.basename(source, '.md'); })
        .reverse()
        .map(function (date) { return getJsonData({ from: date }); })
        .filter(function (_a) {
        var draft = _a.draft;
        return commander_1.default.force || !draft;
    });
}
function main() {
    var allPostsDate = getPostsData();
    outputSummary(allPostsDate);
    outputDetails(allPostsDate);
}
main();
if (commander_1.default.watch) {
    console.log("\n" + chalk_1.default.bgYellow('WATCH') + " " + ENTRIES_PATH + "\n");
    chokidar_1.default.watch(ENTRIES_PATH, { ignoreInitial: true }).on('all', function (event, changePath) {
        var allPostsDate = getPostsData();
        var date = path_1.default.basename(changePath, '.md');
        console.log(chalk_1.default.bgMagenta(event) + " " + changePath);
        outputSummary(allPostsDate);
        var detail = getJsonData({ from: date });
        outputDetail(detail);
        console.log('');
    });
}
