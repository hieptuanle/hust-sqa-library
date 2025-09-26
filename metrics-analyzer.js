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

// Available packages to analyze
const packages = {
  chatgpt: "packages/chatgpt-gpt5-thinking",
  gemini: "packages/google-gemini-2.5-pro",
  grok: "packages/grok-4",
  cursor: "packages/cursor-auto",
  claude: "packages/claude-sonnet-4",
  deepseek: "packages/deepseek",
};

class MetricsAnalyzer {
  constructor() {
    this.results = {};
    this.outputDir = "metrics-reports";
    this.createOutputDirectory();
  }

  createOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async analyzePackage(packageName) {
    const packagePath = packages[packageName];

    if (!packagePath) {
      console.log(
        `${colors.red}❌ Unknown package: ${packageName}${colors.reset}`
      );
      return null;
    }

    const indexFile = path.join(packagePath, "index.js");

    // Check if index.js exists
    if (!fs.existsSync(indexFile)) {
      console.log(
        `${colors.yellow}⚠️  ${packageName}: index.js not found - skipping${colors.reset}`
      );
      return null;
    }

    console.log(`${colors.cyan}📊 Analyzing ${packageName}...${colors.reset}`);

    // Use code-health-meter for comprehensive analysis
    const healthMetrics = await this.getCodeHealthMetrics(indexFile);

    const metrics = {
      package: packageName,
      file: indexFile,
      timestamp: new Date().toISOString(),
      ...healthMetrics,
      // Keep legacy methods as fallback
      duplication: await this.getDuplicationMetrics(packagePath),
      codeQuality: await this.getCodeQualityMetrics(indexFile),
    };

    this.results[packageName] = metrics;

    // Save individual report
    await this.saveIndividualReport(packageName, metrics);

    return metrics;
  }

  async getCodeHealthMetrics(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");

      // Use typhonjs-escomplex for comprehensive analysis
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
        "typhonjs-escomplex failed, using fallback methods:",
        error.message
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

  calculateCustomMaintainabilityIndex(halsteadVolume, cyclomaticComplexity, physicalLOC, commentDensityPercent) {
    // Use minimum values to avoid invalid logarithms
    const safeHalsteadVolume = Math.max(halsteadVolume, 1);
    const safeCyclomaticComplexity = Math.max(cyclomaticComplexity, 1);
    const safePhysicalLOC = Math.max(physicalLOC, 1);
    const safeCommentDensity = Math.max(commentDensityPercent, 0) / 100; // Convert to decimal

    // MI_without_comment = 171 - 5.2 * ln(Avg_Halstead_Volume_Per_Module) - 0.23 * Avg_Cyclomatic_Complexity_Per_Module - 16.2 * ln(Avg_Physical_LOC_Per_Module)
    const miWithoutComment = 171 - 
      (5.2 * Math.log(safeHalsteadVolume)) - 
      (0.23 * safeCyclomaticComplexity) - 
      (16.2 * Math.log(safePhysicalLOC));

    // MI_comment_weight = 50 * sin(sqrt(2.4 * Comment_Density))
    const miCommentWeight = 50 * Math.sin(Math.sqrt(2.4 * safeCommentDensity));

    // MI = MI_without_comment + MI_comment_weight
    const totalMI = miWithoutComment + miCommentWeight;

    return {
      withoutComment: miWithoutComment,
      commentWeight: miCommentWeight,
      total: totalMI
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
    try {
      // Use complexity-report (cr) for detailed complexity analysis
      const output = execSync(`npx cr --format json "${filePath}"`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"], // Suppress stderr
      });
      const data = JSON.parse(output);

      const report = data.reports && data.reports[0];
      if (!report) {
        console.warn("No complexity data from cr tool, using fallback");
        return await this.getBasicComplexityMetrics(filePath);
      }

      return {
        cyclomatic: report.complexity?.cyclomatic || 0,
        cyclomaticDensity: report.complexity?.cyclomaticDensity || 0,
        sloc: report.sloc || {},
        functions:
          report.functions?.map((func) => ({
            name: func.name || "anonymous",
            cyclomatic: func.complexity?.cyclomatic || 0,
            sloc: func.sloc || {},
          })) || [],
        averageComplexity: report.functions
          ? (
              report.functions.reduce(
                (sum, f) => sum + (f.complexity?.cyclomatic || 0),
                0
              ) / report.functions.length
            ).toFixed(2)
          : 0,
      };
    } catch (error) {
      // Fallback: manual complexity calculation
      console.warn(
        "Complexity tool failed, using basic calculation:",
        error.message
      );
      return await this.getBasicComplexityMetrics(filePath);
    }
  }

  async getBasicComplexityMetrics(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");

      // Basic cyclomatic complexity calculation
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

      // Count functions
      const functionMatches =
        content.match(/function\s+\w+|=>\s*{|function\s*\(/g) || [];

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

      // Basic Halstead metrics calculation
      // In Halstead metrics, operators include all keywords, control structures, and symbols
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
        // Exclude JavaScript keywords that are operators
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
      // MI = 171 - 5.2 * ln(Halstead Volume) - 0.23 * (Cyclomatic Complexity) - 16.2 * ln(Lines of Code)
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

  async getDuplicationMetrics(packagePath) {
    try {
      // Use jscpd for code duplication detection
      const output = execSync(
        `npx jscpd "${packagePath}" --reporters json --format javascript --silent`,
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"], // Suppress stderr
        }
      );

      if (!output || output.trim() === "") {
        throw new Error("No output from jscpd");
      }

      const data = JSON.parse(output);

      return {
        duplicatedLines: data.statistics?.duplicatedLines || 0,
        duplicatedFiles: data.statistics?.duplicatedFiles || 0,
        percentage: data.statistics?.percentage || "0.00%",
        clones: data.duplicates?.length || 0,
      };
    } catch (error) {
      // Fallback: basic duplication check
      console.warn("Duplication detection failed:", error.message);
      return {
        duplicatedLines: 0,
        duplicatedFiles: 0,
        percentage: "0.00%",
        clones: 0,
        note: "Basic analysis - detailed duplication detection failed",
      };
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

      // Count imports/requires (dependency coupling)
      const imports = (content.match(/import\s+.+from|require\s*\(/g) || [])
        .length;

      // Count exports (interface coupling)
      const exports = (content.match(/export\s+|module\.exports/g) || [])
        .length;

      return {
        averageLineLength: avgLineLength.toFixed(2),
        maxNestingLevel: maxNesting,
        todoComments: todoCount,
        imports: imports,
        exports: exports,
        couplingIndicator: imports + exports,
        cohesionIndicator: maxNesting, // Higher nesting might indicate lower cohesion
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async saveIndividualReport(packageName, metrics) {
    const reportPath = path.join(this.outputDir, `${packageName}-metrics.json`);
    fs.writeFileSync(reportPath, JSON.stringify(metrics, null, 2));

    // Also create a readable text report
    const txtReportPath = path.join(
      this.outputDir,
      `${packageName}-metrics.txt`
    );
    const report = this.formatTextReport(metrics);
    fs.writeFileSync(txtReportPath, report);

    console.log(
      `  ${colors.green}✅ Report saved: ${reportPath}${colors.reset}`
    );
  }

  formatTextReport(metrics) {
    return `
CODE METRICS REPORT
===================
Package: ${metrics.package}
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
MI Without Comments: ${metrics.maintainability.components?.withoutComment || "N/A"}
MI Comment Weight: ${metrics.maintainability.components?.commentWeight || "N/A"}
Comment Density: ${metrics.maintainability.factors?.commentDensity?.toFixed(2) || "N/A"}%

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

DUPLICATION
-----------
Duplicated Lines: ${
      typeof metrics.duplication.duplicatedLines === "number"
        ? metrics.duplication.duplicatedLines
        : "N/A"
    }
Duplication Percentage: ${metrics.duplication.percentage || "N/A"}
Clone Count: ${
      typeof metrics.duplication.clones === "number"
        ? metrics.duplication.clones
        : "N/A"
    }
`;
  }

  async generateComparisonReport() {
    const comparisonPath = path.join(this.outputDir, "comparison-report.json");
    const comparison = {
      timestamp: new Date().toISOString(),
      packages: this.results,
      summary: this.generateSummary(),
    };

    fs.writeFileSync(comparisonPath, JSON.stringify(comparison, null, 2));

    // Generate CSV for easy analysis
    const csvPath = path.join(this.outputDir, "metrics-comparison.csv");
    const csv = this.generateCSV();
    fs.writeFileSync(csvPath, csv);

    console.log(
      `\n${colors.bright}📈 Comparison reports generated:${colors.reset}`
    );
    console.log(`  ${colors.green}JSON: ${comparisonPath}${colors.reset}`);
    console.log(`  ${colors.green}CSV: ${csvPath}${colors.reset}`);
  }

  generateSummary() {
    const packages = Object.keys(this.results);
    if (packages.length === 0) return {};

    const summary = {
      totalPackages: packages.length,
      averages: {},
      rankings: {},
    };

    // Calculate averages
    const metrics = [
      "loc.source",
      "complexity.cyclomatic",
      "halstead.volume",
      "maintainability.index",
    ];

    for (const metric of metrics) {
      const values = packages.map((pkg) => {
        const value = this.getNestedValue(this.results[pkg], metric);
        return parseFloat(value) || 0;
      });

      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      summary.averages[metric.replace(".", "_")] = avg.toFixed(2);
    }

    // Generate rankings
    summary.rankings.maintainability = packages.sort((a, b) => {
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

    summary.rankings.complexity = packages.sort((a, b) => {
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

  getNestedValue(obj, path) {
    return path
      .split(".")
      .reduce((current, key) => current && current[key], obj);
  }

  generateCSV() {
    const packages = Object.keys(this.results);
    if (packages.length === 0) return "";

    const headers = [
      "Package",
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
      "Duplication_Percentage",
    ];

    let csv = headers.join(",") + "\n";

    for (const pkg of packages) {
      const metrics = this.results[pkg];
      const row = [
        pkg,
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
        metrics.maintainability?.rating || "N/A",
        metrics.codeQuality?.maxNestingLevel || "N/A",
        metrics.codeQuality?.couplingIndicator || "N/A",
        metrics.duplication?.percentage || "N/A",
      ];
      csv += row.join(",") + "\n";
    }

    return csv;
  }

  printSummary() {
    const packages = Object.keys(this.results);
    if (packages.length === 0) {
      console.log(`${colors.yellow}No packages analyzed${colors.reset}`);
      return;
    }

    console.log(`\n${colors.bright}📊 METRICS SUMMARY${colors.reset}`);
    console.log("=".repeat(60));

    // Maintainability ranking
    const maintainabilityRanking = packages.sort((a, b) => {
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

    console.log(`\n${colors.cyan}🏆 Maintainability Ranking:${colors.reset}`);
    maintainabilityRanking.forEach((pkg, index) => {
      const metrics = this.results[pkg];
      const score = metrics.maintainability?.index || "N/A";
      const rating = metrics.maintainability?.rating || "N/A";
      const medal =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";
      console.log(`${medal} ${pkg.padEnd(15)} ${score} (${rating})`);
    });

    // Complexity ranking (lower is better)
    const complexityRanking = packages.sort((a, b) => {
      const aValue =
        parseFloat(
          this.getNestedValue(this.results[a], "complexity.cyclomatic")
        ) || 0;
      const bValue =
        parseFloat(
          this.getNestedValue(this.results[b], "complexity.cyclomatic")
        ) || 0;
      return aValue - bValue;
    });

    console.log(
      `\n${colors.cyan}🎯 Complexity Ranking (Lower is Better):${colors.reset}`
    );
    complexityRanking.forEach((pkg, index) => {
      const metrics = this.results[pkg];
      const complexity = metrics.complexity?.cyclomatic || "N/A";
      const medal =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";
      console.log(`${medal} ${pkg.padEnd(15)} ${complexity}`);
    });

    console.log(
      `\n${colors.green}Analysis complete! Check the ${this.outputDir} directory for detailed reports.${colors.reset}`
    );
  }

  async analyzeAll() {
    console.log(
      `${colors.bright}🔍 Starting comprehensive code metrics analysis...${colors.reset}\n`
    );

    for (const packageName of Object.keys(packages)) {
      await this.analyzePackage(packageName);
    }

    await this.generateComparisonReport();
    this.printSummary();
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const analyzer = new MetricsAnalyzer();

  if (args.length === 0) {
    // Analyze all packages
    await analyzer.analyzeAll();
  } else if (args[0] === "--help" || args[0] === "-h") {
    console.log(`${colors.bright}📊 Code Metrics Analyzer${colors.reset}

Usage:
  node metrics-analyzer.js                    # Analyze all implementations
  node metrics-analyzer.js <package-name>     # Analyze specific implementation
  node metrics-analyzer.js --help            # Show this help

Available packages:
  ${Object.keys(packages)
    .map((name) => `- ${name}`)
    .join("\n  ")}

Metrics included:
  • Lines of Code (LOC) - Physical, Source, Comments, Blank
  • Cyclomatic Complexity - Function and overall complexity
  • Halstead Metrics - Volume, Difficulty, Effort, Bugs
  • Maintainability Index - Microsoft's maintainability formula
  • Code Quality - Coupling, Cohesion indicators
  • Code Duplication - Duplicate code detection

Reports are saved to: ./metrics-reports/
`);
  } else {
    // Analyze specific packages
    for (const packageName of args) {
      await analyzer.analyzePackage(packageName);
    }

    if (Object.keys(analyzer.results).length > 1) {
      await analyzer.generateComparisonReport();
      analyzer.printSummary();
    }
  }
}

main().catch(console.error);
