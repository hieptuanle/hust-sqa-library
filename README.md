# Library Management System - AI Model Comparison

This project compares different AI model implementations of a library management system to analyze code quality, maintainability, and complexity.

## Project Structure

```
hust-sqa-library/
├── packages/
│   ├── chatgpt-gpt5-thinking/       # ChatGPT GPT-5 Thinking implementation
│   ├── google-gemini-2.5-pro/      # Google Gemini 2.5 Pro implementation
│   ├── grok-4/                     # Grok-4 implementation
│   ├── cursor-auto/                # Cursor Auto implementation
│   ├── claude-sonnet-4/            # Claude Sonnet 4 implementation
│   └── deepseek/                   # DeepSeek implementation
├── metrics-reports/                 # Generated code quality reports
├── metrics-analyzer.js             # Custom metrics analysis tool
└── README.md
```

## Library Management Requirements

Viết một chương trình quản lý thư viện sách với các chức năng cơ bản như thêm, xóa, và tìm kiếm sách.

Yêu cầu

- Chương trình phải có giao diện người dùng đơn giản
- Người dùng có thể đăng nhập, đăng xuất, đăng ký
- Người dùng đã đăng nhập có thể thêm một cuốn sách mới vào thư viện với các thông tin: tên sách, tác giả, năm xuất bản.
- Người dùng đã đăng nhập có thể xóa một cuốn sách khỏi thư viện.
- Người dùng có thể tìm kiếm sách theo tên sách hoặc tác giả.
- Chương trình phải lưu trữ dữ liệu vào CSDL

### Prompt

Xem trong file [PROMPT.md](PROMPT.md)

## Available Commands

### Installation

```bash
pnpm install
```

### Running Individual Implementations

```bash
pnpm start:chatgpt    # Run ChatGPT implementation
pnpm start:gemini     # Run Gemini implementation
pnpm start:grok       # Run Grok implementation
pnpm start:cursor     # Run Cursor implementation
pnpm start:claude     # Run Claude implementation
pnpm start:deepseek   # Run DeepSeek implementation
```

### Testing

```bash
pnpm test             # Run all tests
pnpm test:chatgpt     # Test specific implementation
pnpm test:gemini      # Test specific implementation
# ... etc for other models
```

### Code Quality Analysis

```bash
pnpm metrics          # Analyze all implementations
pnpm metrics:chatgpt  # Analyze specific implementation
pnpm analyze:all      # Comprehensive analysis
```

## Metrics Analyzed

### Maintainability Index (MI)

- **MI Formula**: `MI = MI_without_comment + MI_comment_weight`
- **MI_without_comment**: `171 - 5.2 * ln(Avg_Halstead_Volume_Per_Module) - 0.23 * Avg_Cyclomatic_Complexity_Per_Module - 16.2 * ln(Avg_Physical_LOC_Per_Module)`
- **MI_comment_weight**: `50 * sin(sqrt(2.4 * Comment_Density))`

### Rating Scale

- **85+**: Good maintainability
- **65-85**: Moderate maintainability
- **<65**: Difficult to maintain

### Additional Metrics

- Lines of Code (Physical, Source, Comments, Blank)
- Cyclomatic Complexity
- Halstead Metrics (Volume, Difficulty, Effort, Bugs)
- Code Quality Indicators (Coupling, Cohesion, Nesting)
- Code Duplication Detection

## Development

Each package is independent and follows the same structure:

- `index.js`: Entry point
- `package.json`: Package configuration
- `README.md`: Implementation-specific documentation

## Analysis Results

Run `pnpm metrics` to generate comprehensive reports comparing all implementations across various quality metrics.

Reports are generated in the `metrics-reports/` directory including:

- Individual JSON reports for each implementation
- Comparison CSV for easy analysis
- Text-based readable reports
- Maintainability rankings and complexity analysis

## Technology Stack

- **Runtime**: Node.js with ES modules
- **Package Manager**: pnpm with workspaces
- **Analysis Tools**: typhonjs-escomplex, jscpd, complexity-report
- **Code Quality**: Custom metrics analyzer with multiple quality indicators
