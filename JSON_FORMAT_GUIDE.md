# JSON Upload Format Guide

This document describes the accepted JSON formats for uploading specifications to the auditor.

## Format 1: MCAT with Finalized Specs

This is the most common format, where specifications are organized by tier (Primary, Secondary, Tertiary).

```json
{
  "category_name": "Stainless Steel Sheet",
  "mcat_id": "12345",
  "finalized_specs": {
    "finalized_primary_specs": {
      "specs": [
        {
          "spec_name": "Grade",
          "options": ["304", "316", "430"],
          "input_type": "radio_button"
        },
        {
          "spec_name": "Thickness",
          "options": ["0.5 mm", "1.0 mm", "1.5 mm", "2.0 mm"],
          "input_type": "radio_button"
        }
      ]
    },
    "finalized_secondary_specs": {
      "specs": [
        {
          "spec_name": "Finish",
          "options": ["Mirror", "Brushed", "Matte"],
          "input_type": "radio_button"
        }
      ]
    },
    "finalized_tertiary_specs": {
      "specs": [
        {
          "spec_name": "Application",
          "options": ["Construction", "Automotive", "Food Processing"],
          "input_type": "multi_select"
        }
      ]
    }
  }
}
```

## Format 2: Simple Array

A simple array of specifications without categorization.

```json
[
  {
    "spec_name": "Material",
    "options": ["Stainless Steel", "Carbon Steel", "Aluminum"],
    "input_type": "radio_button",
    "tier": "Primary"
  },
  {
    "spec_name": "Width",
    "options": ["1219 mm", "1500 mm", "2000 mm"],
    "input_type": "radio_button",
    "tier": "Secondary"
  }
]
```

## Format 3: Object with Specifications Array

An object containing a specifications array.

```json
{
  "specifications": [
    {
      "spec_name": "Grade",
      "options": ["304", "316L", "430"],
      "input_type": "radio_button",
      "tier": "Primary"
    },
    {
      "spec_name": "Finish",
      "options": ["2B", "BA", "No.4"],
      "input_type": "radio_button",
      "tier": "Secondary"
    }
  ]
}
```

## Format 4: MCAT with Type-Based Specifications

This format uses type fields to categorize specifications (Config, Key, Regular).

```json
{
  "MCAT_ID": "20456",
  "MCAT_Name": "Steel Sheets",
  "Specifications": [
    {
      "name": "Material Grade",
      "type": "Config",
      "options": ["Mild Steel", "SS304", "SS316", "Galvanized"]
    },
    {
      "name": "Surface Finish",
      "type": "Config",
      "options": ["Hot Rolled", "Cold Rolled", "Galvanized", "Polished"]
    },
    {
      "name": "Thickness",
      "type": "Config",
      "options": ["0.5 mm", "1 mm", "2 mm", "3 mm", "5 mm"]
    },
    {
      "name": "Form",
      "type": "Key",
      "options": ["Sheet", "Coil", "Strip", "Cut To Length"]
    },
    {
      "name": "Brand",
      "type": "Regular",
      "options": ["TATA", "JSW", "Sail", "Jindal"]
    }
  ]
}
```

**Type Mapping**:
- `Config` → Primary specifications
- `Key` → Secondary specifications
- `Regular` → Tertiary specifications

## Important Notes

1. **MCAT Name Validation**: If your JSON contains a `category_name` or `MCAT_Name` field, it must match the MCAT name you enter in the form.

2. **Required Fields**:
   - `spec_name` or `name`: The name of the specification (required)
   - `options`: An array of option values (required)

3. **Optional Fields**:
   - `input_type`: Either "radio_button" or "multi_select" (defaults to "radio_button")
   - `tier`: Either "Primary", "Secondary", or "Tertiary" (for Formats 1-3)
   - `type`: Either "Config", "Key", or "Regular" (for Format 4)
   - `mcat_id` or `MCAT_ID`: Category ID (optional)

4. **Common Issues to Avoid**:
   - Duplicate options (e.g., "1500 mm" appearing twice)
   - Overlapping units (e.g., "1219 mm" and "4 ft" as separate options)
   - Irrelevant specifications for the category
   - Options that don't match the specification name

5. **Correct Format for Units**:
   - ✅ Correct: "1219 mm (4 ft)" - units combined in one option
   - ❌ Incorrect: "1219 mm" and "4 ft" as separate options - overlapping values

## Example Files

You can use the Stage 1 output from a previous generation run as input for auditing.
