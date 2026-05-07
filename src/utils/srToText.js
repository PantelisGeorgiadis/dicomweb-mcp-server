import { DICOM_TAG_DICTIONARY } from './dataDictionary.js';
import { dicomPersonName, dicomVal } from './utils.js';

const {
  PatientName,
  PatientID,
  PatientBirthDate,
  PatientSex,
  ReferringPhysicianName,
  StudyDescription,
  SeriesDescription,
  CompletionFlag,
  VerificationFlag,
  ContentDate,
  ContentTime,
  CodeValue,
  CodeMeaning,
  ConceptNameCodeSequence,
  ContentSequence,
  ContinuityOfContent,
  ValueType,
  RelationshipType,
  TextValue,
  PersonName,
  DateTime,
  Date: DicomDate,
  Time,
  UID,
  ConceptCodeSequence,
  MeasuredValueSequence,
  NumericValue,
  MeasurementUnitsCodeSequence,
} = Object.fromEntries(
  Object.entries(DICOM_TAG_DICTIONARY).map(([key, e]) => [
    e.name,
    key.replace(/[(),]/g, '').toUpperCase(),
  ])
);

/**
 * Returns the Value array for a DICOM sequence tag, or an empty array when absent.
 * @method
 * @private
 * @param {Object} item - Raw DICOM JSON object.
 * @param {string} tag  - 8-character uppercase hex tag.
 * @returns {Object[]} Array of sequence items, or `[]`.
 */
function vals(item, tag) {
  return item[tag]?.Value ?? [];
}

/**
 * Returns the Code Meaning from the first item of a DICOM code sequence Value array.
 * @method
 * @private
 * @param {Object[]} seqValues - Value array of a code sequence tag.
 * @returns {string} Code meaning string, or `''` if absent.
 */
function codeMeaning(seqValues) {
  if (!Array.isArray(seqValues) || seqValues.length === 0) {
    return '';
  }
  return dicomVal(seqValues[0], CodeMeaning);
}

/**
 * Converts a single DICOM SR content item to its plain-text body.
 *
 * Dispatches on `ValueType`: `TEXT`, `PNAME`, `DATETIME`, `DATE`, `TIME`,
 * `UIDREF`, `CODE`, `NUM`, and `CONTAINER` (returns `''`).
 * Unrecognised value types return a `[VT not supported]` placeholder.
 * @method
 * @private
 * @param {Object} item - Raw DICOM JSON content item.
 * @returns {string} Plain-text representation of the item's value.
 */
function contentItemBody(item) {
  switch (dicomVal(item, ValueType)) {
    case 'TEXT':
      return dicomVal(item, TextValue);

    case 'PNAME':
      return dicomPersonName(item, PersonName);

    case 'DATETIME':
      return dicomVal(item, DateTime);

    case 'DATE':
      return dicomVal(item, DicomDate);

    case 'TIME':
      return dicomVal(item, Time);

    case 'UIDREF':
      return dicomVal(item, UID);

    case 'CODE':
      return codeMeaning(vals(item, ConceptCodeSequence));

    case 'NUM': {
      const mvItems = vals(item, MeasuredValueSequence);
      if (mvItems.length === 0) {
        return '';
      }
      const mv = mvItems[0];
      const numeric = dicomVal(mv, NumericValue);
      const unitItems = vals(mv, MeasurementUnitsCodeSequence);
      const unit = unitItems.length > 0 ? dicomVal(unitItems[0], CodeValue) : '';
      return unit ? `${numeric} ${unit}` : numeric;
    }

    case 'CONTAINER':
      return '';

    default: {
      const vt = dicomVal(item, ValueType);
      return vt ? `[${vt} not supported]` : '';
    }
  }
}

/**
 * Recursively walks a `ContentSequence` Value array and appends rendered lines.
 *
 * In CONTINUOUS mode, text bodies are concatenated and emitted as a single
 * paragraph under the last concept name encountered. In SEPARATE mode, each
 * item is emitted on its own line, with observation/acquisition context items
 * formatted as `<prefix>: <concept> = <value>`.
 * @method
 * @private
 * @param {Object[]} items      - Value array of a `ContentSequence` tag.
 * @param {string[]} lines      - Accumulator array to push rendered lines into.
 * @param {boolean}  continuous - Whether the parent container is CONTINUOUS.
 */
function processContentSequence(items, lines, continuous) {
  let continuousTitle = '';
  let continuousText = '';

  for (const item of items) {
    const valueType = dicomVal(item, ValueType);
    const conceptName = codeMeaning(vals(item, ConceptNameCodeSequence));
    const bodyText = contentItemBody(item).trim();

    if (bodyText) {
      if (continuous) {
        continuousTitle = conceptName;
        continuousText += /^[a-zA-Z0-9]/.test(bodyText) ? ` ${bodyText}` : bodyText;
      } else {
        const relationshipType = dicomVal(item, RelationshipType);
        if (relationshipType === 'HAS OBS CONTEXT' || relationshipType === 'HAS ACQ CONTEXT') {
          const prefix =
            relationshipType === 'HAS OBS CONTEXT' ? 'Observation Context' : 'Acquisition Context';
          lines.push(`${prefix}: ${conceptName} = ${bodyText}`);
        } else {
          if (conceptName) {
            lines.push(`${conceptName}:`);
          }
          lines.push(bodyText);
        }
      }
    }

    // Recurse into nested containers
    if (valueType === 'CONTAINER') {
      const nested = vals(item, ContentSequence);
      if (nested.length > 0) {
        const nestedContinuous = dicomVal(item, ContinuityOfContent) === 'CONTINUOUS';
        processContentSequence(nested, lines, nestedContinuous);
      }
    }
  }

  if (continuous && continuousText) {
    if (continuousTitle) lines.push(`${continuousTitle}:`);
    lines.push(continuousText.trim());
  }
}

/**
 * Converts a DICOM Structured Report instance (DICOM JSON format, as returned
 * by a DICOMweb metadata endpoint) into a human-readable text string.
 * @method
 * @param {Object} srInstance - A single DICOM JSON instance object.
 * @returns {string} The structured report content as plain text.
 */
export function srToText(srInstance) {
  const lines = [];

  // Header block
  const name = dicomPersonName(srInstance, PatientName);
  const patientId = dicomVal(srInstance, PatientID);
  const sex = dicomVal(srInstance, PatientSex);
  const dob = dicomVal(srInstance, PatientBirthDate);
  const referringPhysician = dicomPersonName(srInstance, ReferringPhysicianName);
  const studyDescription = dicomVal(srInstance, StudyDescription);
  const seriesDescription = dicomVal(srInstance, SeriesDescription);
  const completionFlag = dicomVal(srInstance, CompletionFlag);
  const verificationFlag = dicomVal(srInstance, VerificationFlag);
  const contentDate = dicomVal(srInstance, ContentDate);
  const contentTime = dicomVal(srInstance, ContentTime);

  if (name || patientId) {
    lines.push(`Patient: ${name} (${sex}, ${dob}, ${patientId})`);
  }
  if (referringPhysician) {
    lines.push(`Referring Physician: ${referringPhysician}`);
  }
  if (studyDescription) {
    lines.push(`Study: ${studyDescription}`);
  }
  if (seriesDescription) {
    lines.push(`Series: ${seriesDescription}`);
  }
  if (completionFlag) {
    lines.push(`Completion Flag: ${completionFlag}`);
  }
  if (verificationFlag) {
    lines.push(`Verification Flag: ${verificationFlag}`);
  }
  if (contentDate || contentTime) {
    lines.push(`Content Date/Time: ${contentDate} ${contentTime}`.trim());
  }

  // Report title from root ConceptNameCodeSequence
  const title = codeMeaning(vals(srInstance, ConceptNameCodeSequence));
  if (title) {
    lines.push('', title, '');
  }

  // Content body
  const contentItems = vals(srInstance, ContentSequence);
  if (contentItems.length > 0) {
    const continuous = dicomVal(srInstance, ContinuityOfContent) === 'CONTINUOUS';
    processContentSequence(contentItems, lines, continuous);
  }

  return lines.join('\n');
}
