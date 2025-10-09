# FNC Fix

A webapp for viewing, validating, and modifying FNC files used in steel fabrication and CNC machinery.

## Features

### File Parsing & Display
- **Drag-and-drop** or click to select FNC files
- Parses and displays all FNC file sections:
  - Profiles (PRF)
  - Materials (MAT)
  - Pieces (PCS)
  - Bars/Nests (BAR)

### Validation & Consistency Checks
- **Profile Consistency**: Detects mismatches in profile types throughout the file
- **Material Consistency**: Identifies material inconsistencies throughout the file
- **Length Validation**: Configurable maximum length checks for:
  - Drawing names
  - Position names
- Visual warnings highlight problematic entries

### Modification Tools
- **Text Replacement**: Bulk find-and-replace functionality across the entire file
- **Profile Fixing**: One-click fix to standardize all profiles to match the reference profile
- **Material Fixing**: One-click fix to standardize all materials to match the reference material
- **Download Modified File**: Export corrected FNC file with all changes applied

## Getting Started

### Prerequisites
- Modern web browser
- No installation required - runs entirely in the browser

### Usage

1. **Load a File**
   - Drag and drop an `.fnc` file onto the upload area, or
   - Click "Select File" to browse for a file

2. **Review Data**
   - View parsed profiles, materials, pieces, and bars
   - Check for highlighted warnings indicating inconsistencies or length violations

3. **Configure Options** (Right Panel)
   - Adjust maximum length limits for drawing and position fields
   - Add text replacements
   - Use quick-fix buttons for profile/material consistency

4. **Modify File**
   - Execute text replacements
   - Fix profile or material inconsistencies
   - Download the modified FNC file

## File Structure

```
fnc-fix/
├── index.html          # Main HTML structure
├── css/
│   ├── materialize.min.css
│   └── main.css        # Custom styles
└── js/
    ├── materialize.min.js
    └── main.js         # Core logic
```

## Technical Details

### Key Parameters Parsed

**Profiles (PRF)**
- CP: Profile type
- P: Profile name
- SA: Height (mm)
- TA: Web thickness (mm)
- SB: Width (mm)
- TB: Flange thickness (mm)
- WL: Weight per meter (kg/m)

**Pieces (PCS)**
- C: Project
- D: Drawing
- N: Mark
- POS: Position
- M: Material
- LP: Length (mm)
- RAI/RAF: Web cut angles
- RBI/RBF: Flange cut angles
- QI: Quantity

**Bars (BAR)**
- N: Bar name
- LB: Bar length (mm)
- BI: Bar quantity

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is open source and available under the MIT License.
