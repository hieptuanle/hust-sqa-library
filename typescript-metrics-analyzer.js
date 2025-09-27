#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import ESComplex from "typhonjs-escomplex";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

class JavaScriptMetricsAnalyzer {
  constructor() {
    this.results = {};
    this.outputDir = "js-ts-metrics-reports";
    this.createOutputDirectory();
  }

  createOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async findJavaScriptFiles() {
    try {
      const files = [];
      const ignoreDirs = [
        "node_modules",
        "dist",
        "build",
        "coverage",
        ".claude",
      ];

      const walkDir = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Skip ignored directories
            if (!ignoreDirs.includes(entry.name)) {
              walkDir(fullPath);
            }
          } else if (
            entry.isFile() &&
            (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))
          ) {
            files.push(fullPath);
          }
        }
      };

      walkDir(process.cwd());
      return files;
    } catch (error) {
      console.error(
        `${colors.red}❌ Error finding JavaScript/TypeScript files: ${error.message}${colors.reset}`
      );
      return [];
    }
  }

  async analyzeFile(filePath) {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(
        `${colors.yellow}⚠️  ${filePath}: File not found - skipping${colors.reset}`
      );
      return null;
    }

    const relativePath = path.relative(process.cwd(), filePath);
    console.log(`${colors.cyan}📊 Analyzing ${relativePath}...${colors.reset}`);

    // Use code-health-meter for comprehensive analysis
    const healthMetrics = await this.getCodeHealthMetrics(filePath);

    const metrics = {
      file: relativePath,
      fullPath: filePath,
      timestamp: new Date().toISOString(),
      ...healthMetrics,
      // Additional metrics specific to the file
      codeQuality: await this.getCodeQualityMetrics(filePath),
    };

    this.results[relativePath] = metrics;

    // Save individual report
    await this.saveIndividualReport(relativePath, metrics);

    return metrics;
  }

  async getCodeHealthMetrics(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");

      // Use typhonjs-escomplex for comprehensive analysis
      // For TypeScript files, we need to handle them as JavaScript for now
      const analysis = ESComplex.analyzeModule(content, {
        logicalLineOfCode: true,
        cyclomatic: true,
        halstead: true,
        maintainability: true,
      });

      // Transform typhonjs-escomplex results to our format
      const aggregate = analysis.aggregate || {};
      const sloc = aggregate.sloc || {};
      const halstead = aggregate.halstead || {};
      const methods = analysis.methods || [];

      // Calculate comment density from physical vs logical lines
      const commentLines = (sloc.physical || 0) - (sloc.logical || 0);
      const commentDensityPercent =
        sloc.logical && commentLines > 0
          ? (commentLines / (sloc.logical + commentLines)) * 100
          : 0;
      const commentDensity = `${commentDensityPercent.toFixed(2)}%`;

      // Calculate custom maintainability index using the provided formula
      const customMI = this.calculateCustomMaintainabilityIndex(
        halstead.volume || 0,
        aggregate.cyclomatic || 0,
        sloc.physical || 0,
        commentDensityPercent
      );

      return {
        loc: {
          physical: sloc.physical || 0,
          source: sloc.logical || 0,
          comments: commentLines,
          blank: 0, // typhonjs-escomplex doesn't separate blank lines
          commentDensity: commentDensity,
        },
        complexity: {
          cyclomatic: aggregate.cyclomatic || 0,
          cyclomaticDensity: aggregate.cyclomaticDensity?.toFixed(2) || "0.00",
          functions: methods,
          averageComplexity:
            methods.length > 0
              ? (
                  methods.reduce((sum, fn) => sum + (fn.cyclomatic || 0), 0) /
                  methods.length
                ).toFixed(2)
              : "0.00",
        },
        halstead: {
          uniqueOperators: halstead.operators?.distinct || 0,
          uniqueOperands: halstead.operands?.distinct || 0,
          totalOperators: halstead.operators?.total || 0,
          totalOperands: halstead.operands?.total || 0,
          vocabulary: halstead.vocabulary || 0,
          length: halstead.length || 0,
          calculatedLength: halstead.calculatedLength?.toFixed(2) || "0.00",
          volume: halstead.volume?.toFixed(2) || "0.00",
          difficulty: halstead.difficulty?.toFixed(2) || "0.00",
          effort: halstead.effort?.toFixed(2) || "0.00",
          timeRequired: halstead.time
            ? `${halstead.time.toFixed(2)} seconds`
            : "0.00 seconds",
          bugsDelivered: halstead.bugs?.toFixed(4) || "0.0000",
        },
        maintainability: {
          index: customMI.total.toFixed(2),
          rating: this.getMaintainabilityRating(customMI.total),
          factors: {
            halsteadVolume: halstead.volume || 0,
            cyclomaticComplexity: aggregate.cyclomatic || 0,
            linesOfCode: sloc.physical || 0,
            commentDensity: commentDensityPercent,
          },
          components: {
            withoutComment: customMI.withoutComment.toFixed(2),
            commentWeight: customMI.commentWeight.toFixed(2),
          },
        },
      };
    } catch (error) {
      console.warn(
        `${colors.yellow}⚠️  Analysis failed for ${filePath}, using fallback methods: ${error.message}${colors.reset}`
      );

      // Fallback to original methods if typhonjs-escomplex fails
      return {
        loc: await this.getLOCMetrics(filePath),
        complexity: await this.getComplexityMetrics(filePath),
        halstead: await this.getHalsteadMetrics(filePath),
        maintainability: await this.getMaintainabilityIndex(filePath),
      };
    }
  }

  calculateCustomMaintainabilityIndex(
    halsteadVolume,
    cyclomaticComplexity,
    physicalLOC,
    commentDensityPercent
  ) {
    // Use minimum values to avoid invalid logarithms
    const safeHalsteadVolume = Math.max(halsteadVolume, 1);
    const safeCyclomaticComplexity = Math.max(cyclomaticComplexity, 1);
    const safePhysicalLOC = Math.max(physicalLOC, 1);
    const safeCommentDensity = Math.max(commentDensityPercent, 0) / 100; // Convert to decimal

    // MI_without_comment = 171 - 5.2 * ln(Avg_Halstead_Volume_Per_Module) - 0.23 * Avg_Cyclomatic_Complexity_Per_Module - 16.2 * ln(Avg_Physical_LOC_Per_Module)
    const miWithoutComment =
      171 -
      5.2 * Math.log(safeHalsteadVolume) -
      0.23 * safeCyclomaticComplexity -
      16.2 * Math.log(safePhysicalLOC);

    // MI_comment_weight = 50 * sin(sqrt(2.4 * Comment_Density))
    const miCommentWeight = 50 * Math.sin(Math.sqrt(2.4 * safeCommentDensity));

    // MI = MI_without_comment + MI_comment_weight
    const totalMI = miWithoutComment + miCommentWeight;

    return {
      withoutComment: miWithoutComment,
      commentWeight: miCommentWeight,
      total: totalMI,
    };
  }

  getMaintainabilityRating(index) {
    if (!index || index < 0) return "Unknown";
    if (index >= 85) return "Good";
    else if (index >= 65) return "Moderate";
    else return "Difficult to maintain";
  }

  async getLOCMetrics(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");

      // Count different types of lines
      let physical = lines.length;
      let source = 0;
      let comments = 0;
      let blank = 0;
      let inBlockComment = false;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === "") {
          blank++;
        } else if (inBlockComment) {
          comments++;
          if (trimmed.includes("*/")) {
            inBlockComment = false;
          }
        } else if (trimmed.startsWith("/*")) {
          comments++;
          if (!trimmed.includes("*/")) {
            inBlockComment = true;
          }
        } else if (trimmed.startsWith("//")) {
          comments++;
        } else {
          source++;
        }
      }

      return {
        physical: physical,
        source: source,
        comments: comments,
        blank: blank,
        commentDensity:
          ((comments / (source + comments)) * 100).toFixed(2) + "%",
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async getComplexityMetrics(filePath) {
    return await this.getBasicComplexityMetrics(filePath);
  }

  async getBasicComplexityMetrics(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");

      // Basic cyclomatic complexity calculation (includes TypeScript specific constructs)
      const complexityKeywords = [
        "if",
        "else if",
        "while",
        "for",
        "do",
        "switch",
        "case",
        "catch",
        "try",
        "&&",
        "||",
        "?",
        "break",
        "continue",
        "return",
        "throw",
        "finally",
        // TypeScript specific
        "interface",
        "type",
        "enum",
        "namespace",
        "module",
      ];

      let complexity = 1; // Base complexity
      for (const keyword of complexityKeywords) {
        // Escape special regex characters and handle operators differently
        let pattern;
        if (["&&", "||", "?"].includes(keyword)) {
          pattern = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        } else {
          pattern = `\\b${keyword}\\b`;
        }
        const regex = new RegExp(pattern, "g");
        const matches = content.match(regex);
        if (matches) {
          complexity += matches.length;
        }
      }

      // Count functions (including TypeScript arrow functions and methods)
      const functionMatches =
        content.match(/function\s+\w+|=>\s*{|function\s*\(|:\s*\(.*\)\s*=>/g) ||
        [];

      return {
        cyclomatic: complexity,
        cyclomaticDensity: (
          complexity / (content.split("\n").length || 1)
        ).toFixed(2),
        functions: functionMatches.length,
        averageComplexity:
          functionMatches.length > 0
            ? (complexity / functionMatches.length).toFixed(2)
            : complexity,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async getHalsteadMetrics(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");

      // Enhanced Halstead metrics for TypeScript
      const symbolOperators = [
        "+",
        "-",
        "*",
        "/",
        "%",
        "=",
        "==",
        "===",
        "!=",
        "!==",
        "<",
        ">",
        "<=",
        ">=",
        "&&",
        "||",
        "!",
        "?",
        ":",
        ";",
        ",",
        "(",
        ")",
        "{",
        "}",
        "[",
        "]",
        ".",
        "++",
        "--",
        "+=",
        "-=",
        "*=",
        "/=",
        "%=",
        "**=",
        "=>",
        "&",
        "|",
        "^",
        "~",
        "<<",
        ">>",
        ">>>",
        "&=",
        "|=",
        "^=",
        "**",
        "??",
        "?.",
        "??=",
        "||=",
        "&&=",
      ];

      const keywordOperators = [
        "if",
        "else",
        "for",
        "while",
        "do",
        "switch",
        "case",
        "default",
        "break",
        "continue",
        "function",
        "return",
        "var",
        "let",
        "const",
        "class",
        "extends",
        "super",
        "this",
        "new",
        "delete",
        "typeof",
        "instanceof",
        "in",
        "of",
        "try",
        "catch",
        "finally",
        "throw",
        "async",
        "await",
        "yield",
        "import",
        "export",
        "from",
        "as",
        "default",
        "true",
        "false",
        "null",
        "undefined",
        "void",
        "with",
        "debugger",
        "static",
        "get",
        "set",
        "constructor",
        // TypeScript specific keywords
        "interface",
        "type",
        "enum",
        "namespace",
        "module",
        "declare",
        "abstract",
        "implements",
        "private",
        "protected",
        "public",
        "readonly",
        "keyof",
        "typeof",
      ];

      const allOperators = [...symbolOperators, ...keywordOperators];
      const operatorCounts = {};
      let totalOperators = 0;

      // Count operators
      for (const op of allOperators) {
        try {
          let regex;

          // Handle keywords vs symbols differently
          if (keywordOperators.includes(op)) {
            // For keywords, use word boundaries
            regex = new RegExp(`\\b${op}\\b`, "g");
          } else {
            // For symbols, escape special regex characters
            const escapedOp = op.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            regex = new RegExp(escapedOp, "g");
          }

          const matches = content.match(regex) || [];
          if (matches.length > 0) {
            operatorCounts[op] = matches.length;
            totalOperators += matches.length;
          }
        } catch (error) {
          // Skip operators that cause regex issues
          console.warn(
            `Skipping operator '${op}' due to regex error:`,
            error.message
          );
        }
      }

      // Count operands (identifiers and literals, excluding keywords that are operators)
      const operandRegex =
        /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|\b\d+(?:\.\d+)?\b|"[^"]*"|'[^']*'|`[^`]*`/g;
      const allTokens = content.match(operandRegex) || [];

      // Filter out keywords that are counted as operators
      const operands = allTokens.filter((token) => {
        // Exclude JavaScript/TypeScript keywords that are operators
        return (
          !keywordOperators.includes(token) &&
          // Also exclude reserved words that might appear
          !/^(true|false|null|undefined)$/.test(token)
        );
      });

      const uniqueOperands = [...new Set(operands)];

      const n1 = Object.keys(operatorCounts).length; // unique operators
      const n2 = uniqueOperands.length; // unique operands
      const N1 = totalOperators; // total operators
      const N2 = operands.length; // total operands

      const vocabulary = n1 + n2;
      const length = N1 + N2;

      // Handle edge cases where values might be zero
      const calculatedLength =
        n1 > 0 && n2 > 0 ? n1 * Math.log2(n1) + n2 * Math.log2(n2) : length;
      const volume =
        vocabulary > 0 && length > 0 ? length * Math.log2(vocabulary) : 0;
      const difficulty = n1 > 0 && n2 > 0 ? (n1 / 2) * (N2 / n2) : 1;
      const effort = difficulty * volume;
      const timeRequired = effort / 18; // seconds
      const bugsDelivered = volume / 3000;

      return {
        uniqueOperators: n1,
        uniqueOperands: n2,
        totalOperators: N1,
        totalOperands: N2,
        vocabulary: vocabulary,
        length: length,
        calculatedLength: calculatedLength.toFixed(2),
        volume: volume.toFixed(2),
        difficulty: difficulty.toFixed(2),
        effort: effort.toFixed(2),
        timeRequired: timeRequired.toFixed(2) + " seconds",
        bugsDelivered: bugsDelivered.toFixed(4),
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async getMaintainabilityIndex(filePath) {
    try {
      const loc = await this.getLOCMetrics(filePath);
      const complexity = await this.getComplexityMetrics(filePath);
      const halstead = await this.getHalsteadMetrics(filePath);

      // Microsoft's Maintainability Index formula
      const volume = parseFloat(halstead.volume) || 1;
      const cyclomaticComplexity = complexity.cyclomatic || 1;
      const linesOfCode = loc.source || 1;

      const mi =
        171 -
        5.2 * Math.log(volume) -
        0.23 * cyclomaticComplexity -
        16.2 * Math.log(linesOfCode);
      const normalizedMI = Math.max(0, (mi / 171) * 100); // Normalize to 0-100 scale

      let rating;
      if (normalizedMI >= 85) rating = "Excellent";
      else if (normalizedMI >= 70) rating = "Good";
      else if (normalizedMI >= 50) rating = "Moderate";
      else if (normalizedMI >= 25) rating = "Low";
      else rating = "Critical";

      return {
        index: mi.toFixed(2),
        normalizedIndex: normalizedMI.toFixed(2),
        rating: rating,
        factors: {
          halsteadVolume: volume,
          cyclomaticComplexity: cyclomaticComplexity,
          linesOfCode: linesOfCode,
        },
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async getCodeQualityMetrics(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");

      // Calculate various quality metrics
      const lines = content.split("\n");
      const avgLineLength =
        lines.reduce((sum, line) => sum + line.length, 0) / lines.length;

      // Count TODO/FIXME comments
      const todoCount = (content.match(/TODO|FIXME|HACK|BUG/gi) || []).length;

      // Count nested levels (rough coupling indicator)
      let maxNesting = 0;
      let currentNesting = 0;

      for (const char of content) {
        if (char === "{") {
          currentNesting++;
          maxNesting = Math.max(maxNesting, currentNesting);
        } else if (char === "}") {
          currentNesting--;
        }
      }

      // Count imports/requires (dependency coupling) - enhanced for TypeScript
      const imports = (
        content.match(/import\s+.+from|require\s*\(|import\s*\(/g) || []
      ).length;

      // Count exports (interface coupling) - enhanced for TypeScript
      const exports = (content.match(/export\s+|module\.exports/g) || [])
        .length;

      // TypeScript specific metrics
      const interfaces = (content.match(/interface\s+\w+/g) || []).length;
      const types = (content.match(/type\s+\w+/g) || []).length;
      const enums = (content.match(/enum\s+\w+/g) || []).length;

      return {
        averageLineLength: avgLineLength.toFixed(2),
        maxNestingLevel: maxNesting,
        todoComments: todoCount,
        imports: imports,
        exports: exports,
        couplingIndicator: imports + exports,
        cohesionIndicator: maxNesting, // Higher nesting might indicate lower cohesion
        // TypeScript specific
        interfaces: interfaces,
        types: types,
        enums: enums,
        typeDefinitions: interfaces + types + enums,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async saveIndividualReport(fileName, metrics) {
    const safeFileName = fileName.replace(/[/\\:*?"<>|]/g, "_");
    const reportPath = path.join(
      this.outputDir,
      `${safeFileName}-metrics.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(metrics, null, 2));

    // Also create a readable text report
    const txtReportPath = path.join(
      this.outputDir,
      `${safeFileName}-metrics.txt`
    );
    const report = this.formatTextReport(metrics);
    fs.writeFileSync(txtReportPath, report);
  }

  formatTextReport(metrics) {
    return `
CODE METRICS REPORT
===================
File: ${metrics.file}
Analysis Date: ${metrics.timestamp}

LINES OF CODE (LOC)
-------------------
Physical Lines: ${metrics.loc.physical || "N/A"}
Source Lines: ${metrics.loc.source || "N/A"}
Comment Lines: ${metrics.loc.comments || "N/A"}
Blank Lines: ${metrics.loc.blank || "N/A"}
Comment Density: ${metrics.loc.commentDensity || "N/A"}

COMPLEXITY METRICS
------------------
Cyclomatic Complexity: ${metrics.complexity.cyclomatic || "N/A"}
Cyclomatic Density: ${metrics.complexity.cyclomaticDensity || "N/A"}
Average Function Complexity: ${metrics.complexity.averageComplexity || "N/A"}
Number of Functions: ${
      Array.isArray(metrics.complexity.functions)
        ? metrics.complexity.functions.length
        : metrics.complexity.functions || "N/A"
    }

HALSTEAD METRICS
----------------
Unique Operators: ${metrics.halstead.uniqueOperators || "N/A"}
Unique Operands: ${metrics.halstead.uniqueOperands || "N/A"}
Vocabulary: ${metrics.halstead.vocabulary || "N/A"}
Length: ${metrics.halstead.length || "N/A"}
Volume: ${metrics.halstead.volume || "N/A"}
Difficulty: ${metrics.halstead.difficulty || "N/A"}
Effort: ${metrics.halstead.effort || "N/A"}
Time Required: ${metrics.halstead.timeRequired || "N/A"}
Bugs Delivered: ${metrics.halstead.bugsDelivered || "N/A"}

MAINTAINABILITY
---------------
Maintainability Index: ${metrics.maintainability.index || "N/A"}
Rating: ${metrics.maintainability.rating || "N/A"}
MI Without Comments: ${
      metrics.maintainability.components?.withoutComment || "N/A"
    }
MI Comment Weight: ${metrics.maintainability.components?.commentWeight || "N/A"}
Comment Density: ${
      metrics.maintainability.factors?.commentDensity?.toFixed(2) || "N/A"
    }%

CODE QUALITY
------------
Average Line Length: ${metrics.codeQuality.averageLineLength || "N/A"}
Max Nesting Level: ${metrics.codeQuality.maxNestingLevel || "N/A"}
TODO Comments: ${
      typeof metrics.codeQuality.todoComments === "number"
        ? metrics.codeQuality.todoComments
        : "N/A"
    }
Imports: ${
      typeof metrics.codeQuality.imports === "number"
        ? metrics.codeQuality.imports
        : "N/A"
    }
Exports: ${
      typeof metrics.codeQuality.exports === "number"
        ? metrics.codeQuality.exports
        : "N/A"
    }
Coupling Indicator: ${metrics.codeQuality.couplingIndicator || "N/A"}

TYPESCRIPT SPECIFIC
-------------------
Interfaces: ${metrics.codeQuality.interfaces || "N/A"}
Types: ${metrics.codeQuality.types || "N/A"}
Enums: ${metrics.codeQuality.enums || "N/A"}
Total Type Definitions: ${metrics.codeQuality.typeDefinitions || "N/A"}
`;
  }

  async generateComparisonReport() {
    const comparisonPath = path.join(this.outputDir, "comparison-report.json");
    const comparison = {
      timestamp: new Date().toISOString(),
      files: this.results,
      summary: this.generateSummary(),
    };

    fs.writeFileSync(comparisonPath, JSON.stringify(comparison, null, 2));

    // Generate CSV for easy analysis
    const csvPath = path.join(this.outputDir, "metrics-comparison.csv");
    const csv = this.generateCSV();
    fs.writeFileSync(csvPath, csv);

    // Generate package aggregation CSV
    const packageCsvPath = path.join(this.outputDir, "package-aggregation.csv");
    const packageCsv = this.generatePackageCSV();
    fs.writeFileSync(packageCsvPath, packageCsv);

    console.log(
      `\n${colors.bright}📈 Comparison reports generated:${colors.reset}`
    );
    console.log(`  ${colors.green}JSON: ${comparisonPath}${colors.reset}`);
    console.log(`  ${colors.green}File CSV: ${csvPath}${colors.reset}`);
    console.log(
      `  ${colors.green}Package CSV: ${packageCsvPath}${colors.reset}`
    );
  }

  generateSummary() {
    const files = Object.keys(this.results);
    if (files.length === 0) return {};

    const summary = {
      totalFiles: files.length,
      averages: {},
      totals: {},
      rankings: {},
      packageAggregation: this.generatePackageAggregation(),
    };

    // Calculate averages and totals
    const metrics = [
      "loc.source",
      "complexity.cyclomatic",
      "halstead.volume",
      "maintainability.index",
    ];

    for (const metric of metrics) {
      const values = files.map((file) => {
        const value = this.getNestedValue(this.results[file], metric);
        return parseFloat(value) || 0;
      });

      const total = values.reduce((sum, val) => sum + val, 0);
      const avg = total / values.length;
      summary.averages[metric.replace(".", "_")] = avg.toFixed(2);
      summary.totals[metric.replace(".", "_")] = total.toFixed(2);
    }

    // Generate rankings
    summary.rankings.maintainability = files.sort((a, b) => {
      const aValue =
        parseFloat(
          this.getNestedValue(this.results[a], "maintainability.index")
        ) || 0;
      const bValue =
        parseFloat(
          this.getNestedValue(this.results[b], "maintainability.index")
        ) || 0;
      return bValue - aValue;
    });

    summary.rankings.complexity = files.sort((a, b) => {
      const aValue =
        parseFloat(
          this.getNestedValue(this.results[a], "complexity.cyclomatic")
        ) || 0;
      const bValue =
        parseFloat(
          this.getNestedValue(this.results[b], "complexity.cyclomatic")
        ) || 0;
      return aValue - bValue; // Lower complexity is better
    });

    return summary;
  }

  generatePackageAggregation() {
    const files = Object.keys(this.results);
    const packageGroups = {};

    // Group files by package
    for (const file of files) {
      // Extract package name from file path (e.g., "packages/claude/src/..." -> "claude")
      const pathParts = file.split("/");
      if (pathParts.length > 1 && pathParts[0] === "packages") {
        const packageName = pathParts[1];
        if (!packageGroups[packageName]) {
          packageGroups[packageName] = [];
        }
        packageGroups[packageName].push(file);
      }
    }

    const packageAggregation = {};

    for (const [packageName, packageFiles] of Object.entries(packageGroups)) {
      const fileCount = packageFiles.length;

      // Calculate averages for each metric
      const avgLOC = this.calculatePackageAverage(packageFiles, "loc.source");
      const avgPhysicalLOC = this.calculatePackageAverage(
        packageFiles,
        "loc.physical"
      );
      const avgCommentLines = this.calculatePackageAverage(
        packageFiles,
        "loc.comments"
      );
      const avgComplexity = this.calculatePackageAverage(
        packageFiles,
        "complexity.cyclomatic"
      );
      const avgVolume = this.calculatePackageAverage(
        packageFiles,
        "halstead.volume"
      );

      // Calculate average comment percentage
      const commentPercentages = packageFiles.map((file) => {
        const metrics = this.results[file];
        const commentDensityStr = metrics.loc?.commentDensity || "0.00%";
        return parseFloat(commentDensityStr.replace("%", "")) || 0;
      });
      const avgCommentPercentage =
        commentPercentages.reduce((sum, val) => sum + val, 0) /
        commentPercentages.length;

      // Calculate package-level Maintainability Index based on average values
      // MI = 171 - 5.2 * ln(Avg_Halstead_Volume_Per_Module) - 0.23 * Avg_Cyclomatic_Complexity_Per_Module - 16.2 * ln(Avg_Physical_LOC_Per_Module)
      const safeAvgVolume = Math.max(avgVolume, 1);
      const safeAvgComplexity = Math.max(avgComplexity, 1);
      const safeAvgPhysicalLOC = Math.max(avgPhysicalLOC, 1);
      const safeAvgCommentPercentage = Math.max(avgCommentPercentage, 0) / 100;

      const miWithoutComment =
        171 -
        5.2 * Math.log(safeAvgVolume) -
        0.23 * safeAvgComplexity -
        16.2 * Math.log(safeAvgPhysicalLOC);

      const miCommentWeight =
        50 * Math.sin(Math.sqrt(2.4 * safeAvgCommentPercentage));
      const packageMI = miWithoutComment + miCommentWeight;

      packageAggregation[packageName] = {
        fileCount: fileCount,
        files: packageFiles,
        averages: {
          linesOfCode: avgLOC.toFixed(2),
          physicalLOC: avgPhysicalLOC.toFixed(2),
          commentLines: avgCommentLines.toFixed(2),
          commentPercentage: avgCommentPercentage.toFixed(2) + "%",
          cyclomaticComplexity: avgComplexity.toFixed(2),
          halsteadVolume: avgVolume.toFixed(2),
        },
        maintainabilityIndex: {
          value: packageMI.toFixed(2),
          rating: this.getMaintainabilityRating(packageMI),
          components: {
            withoutComment: miWithoutComment.toFixed(2),
            commentWeight: miCommentWeight.toFixed(2),
          },
        },
      };
    }

    return packageAggregation;
  }

  calculatePackageAverage(files, metricPath) {
    const values = files.map((file) => {
      const value = this.getNestedValue(this.results[file], metricPath);
      return parseFloat(value) || 0;
    });
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  getNestedValue(obj, path) {
    return path
      .split(".")
      .reduce((current, key) => current && current[key], obj);
  }

  generateCSV() {
    const files = Object.keys(this.results);
    if (files.length === 0) return "";

    const headers = [
      "File",
      "Physical_LOC",
      "Source_LOC",
      "Comment_LOC",
      "Comment_Density",
      "Cyclomatic_Complexity",
      "Average_Function_Complexity",
      "Function_Count",
      "Halstead_Volume",
      "Halstead_Difficulty",
      "Halstead_Effort",
      "Maintainability_Index",
      "Maintainability_Rating",
      "Max_Nesting_Level",
      "Coupling_Indicator",
      "Interfaces",
      "Types",
      "Enums",
    ];

    let csv = headers.join(",") + "\n";

    for (const file of files) {
      const metrics = this.results[file];
      const row = [
        `"${file}"`,
        metrics.loc?.physical || "N/A",
        metrics.loc?.source || "N/A",
        metrics.loc?.comments || "N/A",
        metrics.loc?.commentDensity || "N/A",
        metrics.complexity?.cyclomatic || "N/A",
        metrics.complexity?.averageComplexity || "N/A",
        metrics.complexity?.functions?.length || "N/A",
        metrics.halstead?.volume || "N/A",
        metrics.halstead?.difficulty || "N/A",
        metrics.halstead?.effort || "N/A",
        metrics.maintainability?.index || "N/A",
        `"${metrics.maintainability?.rating || "N/A"}"`,
        metrics.codeQuality?.maxNestingLevel || "N/A",
        metrics.codeQuality?.couplingIndicator || "N/A",
        metrics.codeQuality?.interfaces || "N/A",
        metrics.codeQuality?.types || "N/A",
        metrics.codeQuality?.enums || "N/A",
      ];
      csv += row.join(",") + "\n";
    }

    return csv;
  }

  generatePackageCSV() {
    const summary = this.generateSummary();
    const packageAggregation = summary.packageAggregation;
    const packages = Object.keys(packageAggregation);

    if (packages.length === 0) return "";

    const headers = [
      "Package",
      "File_Count",
      "Avg_Lines_Of_Code",
      "Avg_Physical_LOC",
      "Avg_Comment_Lines",
      "Avg_Comment_Percentage",
      "Avg_Cyclomatic_Complexity",
      "Avg_Halstead_Volume",
      "Maintainability_Index",
      "MI_Rating",
      "MI_Without_Comments",
      "MI_Comment_Weight",
    ];

    let csv = headers.join(",") + "\n";

    for (const packageName of packages) {
      const pkg = packageAggregation[packageName];
      const row = [
        `"${packageName}"`,
        pkg.fileCount,
        pkg.averages.linesOfCode,
        pkg.averages.physicalLOC,
        pkg.averages.commentLines,
        pkg.averages.commentPercentage,
        pkg.averages.cyclomaticComplexity,
        pkg.averages.halsteadVolume,
        pkg.maintainabilityIndex.value,
        `"${pkg.maintainabilityIndex.rating}"`,
        pkg.maintainabilityIndex.components.withoutComment,
        pkg.maintainabilityIndex.components.commentWeight,
      ];
      csv += row.join(",") + "\n";
    }

    return csv;
  }

  printSummary() {
    const files = Object.keys(this.results);
    if (files.length === 0) {
      console.log(`${colors.yellow}No files analyzed${colors.reset}`);
      return;
    }

    console.log(
      `\n${colors.bright}📆 JAVASCRIPT/TYPESCRIPT METRICS SUMMARY${colors.reset}`
    );
    console.log("=".repeat(60));
    console.log(
      `${colors.cyan}Total Files Analyzed: ${files.length}${colors.reset}`
    );

    // Show project totals
    const summary = this.generateSummary();
    console.log(`\n${colors.bright}PROJECT TOTALS:${colors.reset}`);
    console.log(`  Total Source Lines: ${summary.totals?.loc_source || "N/A"}`);
    console.log(
      `  Total Cyclomatic Complexity: ${
        summary.totals?.complexity_cyclomatic || "N/A"
      }`
    );
    console.log(
      `  Average Maintainability Index: ${
        summary.averages?.maintainability_index || "N/A"
      }`
    );

    // Package-level aggregation
    const packageAggregation = summary.packageAggregation;
    const packages = Object.keys(packageAggregation).sort((a, b) => {
      const aValue =
        parseFloat(packageAggregation[a].maintainabilityIndex.value) || 0;
      const bValue =
        parseFloat(packageAggregation[b].maintainabilityIndex.value) || 0;
      return bValue - aValue;
    });

    if (packages.length > 0) {
      console.log(
        `\n${colors.bright}📦 PACKAGE AGGREGATION (${packages.length} packages):${colors.reset}`
      );
      console.log("=".repeat(80));

      for (const packageName of packages) {
        const pkg = packageAggregation[packageName];
        console.log(
          `\n${colors.bright}${packageName.toUpperCase()}${colors.reset} (${
            pkg.fileCount
          } files)`
        );
        console.log(`  Avg Lines of Code: ${pkg.averages.linesOfCode}`);
        console.log(
          `  Avg Comment Percentage: ${pkg.averages.commentPercentage}`
        );
        console.log(`  Avg Complexity: ${pkg.averages.cyclomaticComplexity}`);
        console.log(`  Avg Halstead Volume: ${pkg.averages.halsteadVolume}`);
        console.log(
          `  Maintainability Index: ${colors.green}${pkg.maintainabilityIndex.value}${colors.reset} (${pkg.maintainabilityIndex.rating})`
        );
      }

      // Package ranking
      console.log(
        `\n${colors.cyan}🏆 Package Maintainability Ranking:${colors.reset}`
      );
      packages.forEach((packageName, index) => {
        const pkg = packageAggregation[packageName];
        const medal =
          index === 0
            ? "🥇"
            : index === 1
            ? "🥈"
            : index === 2
            ? "🥉"
            : `${index + 1}.`;
        console.log(
          `${medal} ${packageName.padEnd(20)} MI: ${
            pkg.maintainabilityIndex.value
          } (${pkg.maintainabilityIndex.rating})`
        );
      });
    }

    // Maintainability ranking (top 10 files)
    const maintainabilityRanking = files.sort((a, b) => {
      const aValue =
        parseFloat(
          this.getNestedValue(this.results[a], "maintainability.index")
        ) || 0;
      const bValue =
        parseFloat(
          this.getNestedValue(this.results[b], "maintainability.index")
        ) || 0;
      return bValue - aValue;
    });

    console.log(
      `\n${colors.cyan}🏆 Top 10 Most Maintainable Files:${colors.reset}`
    );
    maintainabilityRanking.slice(0, 10).forEach((file, index) => {
      const metrics = this.results[file];
      const score = metrics.maintainability?.index || "N/A";
      const rating = metrics.maintainability?.rating || "N/A";
      const medal =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `${index + 1}.`;
      console.log(`${medal} ${file.padEnd(30)} ${score} (${rating})`);
    });

    console.log(
      `\n${colors.green}Analysis complete! Check the ${this.outputDir} directory for detailed reports.${colors.reset}`
    );
  }

  async analyzeAll() {
    console.log(
      `${colors.bright}🔍 Starting comprehensive JavaScript/TypeScript metrics analysis...${colors.reset}\n`
    );

    const files = await this.findJavaScriptFiles();

    if (files.length === 0) {
      console.log(
        `${colors.yellow}No JavaScript/TypeScript files found in the project.${colors.reset}`
      );
      return;
    }

    console.log(
      `${colors.cyan}Found ${files.length} JavaScript/TypeScript files${colors.reset}\n`
    );

    for (const filePath of files) {
      await this.analyzeFile(filePath);
    }

    await this.generateComparisonReport();
    this.printSummary();
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const analyzer = new JavaScriptMetricsAnalyzer();

  if (args.length === 0) {
    // Analyze all TypeScript files
    await analyzer.analyzeAll();
  } else if (args[0] === "--help" || args[0] === "-h") {
    console.log(`${colors.bright}📆 JavaScript/TypeScript Code Metrics Analyzer${colors.reset}\n
Usage:
  node typescript-metrics-analyzer.js                    # Analyze all JS/TS files
  node typescript-metrics-analyzer.js <file-path>        # Analyze specific file
  node typescript-metrics-analyzer.js --help            # Show this help

Metrics included:
  • Lines of Code (LOC) - Physical, Source, Comments, Blank
  • Cyclomatic Complexity - Function and overall complexity
  • Halstead Metrics - Volume, Difficulty, Effort, Bugs
  • Maintainability Index - Microsoft's maintainability formula
  • Code Quality - Coupling, Cohesion indicators
  • TypeScript Specific - Interfaces, Types, Enums
  • Package Aggregation - Package-level metrics and rankings

Reports are saved to: ./js-ts-metrics-reports/
`);
  } else {
    // Analyze specific files
    for (const filePath of args) {
      const fullPath = path.resolve(filePath);
      await analyzer.analyzeFile(fullPath);
    }

    if (Object.keys(analyzer.results).length > 1) {
      await analyzer.generateComparisonReport();
      analyzer.printSummary();
    }
  }
}

main().catch(console.error);
