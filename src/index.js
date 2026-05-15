import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

import './polyfill.js';
import { getEncapsulatedPdfReportText } from './tools/getEncapsulatedPdfReportText.js';
import { getInstanceMetadata } from './tools/getInstanceMetadata.js';
import { getStructuredReportText } from './tools/getStructuredReportText.js';
import { renderInstanceFrame } from './tools/renderInstanceFrame.js';
import { searchEncapsulatedPdfReports } from './tools/searchEncapsulatedPdfReports.js';
import { searchInstances } from './tools/searchInstances.js';
import { searchSeries } from './tools/searchSeries.js';
import { searchStructuredReports } from './tools/searchStructuredReports.js';
import { searchStudies } from './tools/searchStudies.js';
import { formatResults } from './utils/resultsFormatter.js';

// Resolve .env relative to the running script so it is found regardless of process.cwd()
const __dirname = path.dirname(process.argv[1]);
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

// Reusable Zod schemas for the three DICOM UID parameters
const studyUidSchema = z
  .string()
  .regex(/^[0-9]+(\.[0-9]+)*$/, 'StudyInstanceUID must be a valid DICOM UID')
  .max(64, 'StudyInstanceUID must not exceed 64 characters')
  .describe('DICOM Study Instance UID (e.g., 1.2.840.113619.2.55.3). Obtain from find-studies.');

const seriesUidSchema = z
  .string()
  .regex(/^[0-9]+(\.[0-9]+)*$/, 'SeriesInstanceUID must be a valid DICOM UID')
  .max(64, 'SeriesInstanceUID must not exceed 64 characters')
  .describe(
    'DICOM Series Instance UID (e.g., 1.2.840.113619.2.55.3.604688123). Obtain from find-series.'
  );

const sopUidSchema = z
  .string()
  .regex(/^[0-9]+(\.[0-9]+)*$/, 'SOPInstanceUID must be a valid DICOM UID')
  .max(64, 'SOPInstanceUID must not exceed 64 characters')
  .describe(
    'DICOM SOP Instance UID (e.g., 1.2.840.113619.2.55.3.604688123.123.1591781234.469). Obtain from find-instances.'
  );

// Helper to build standard text and image MCP responses
const textContent = (text) => ({ content: [{ type: 'text', text }] });
const errorContent = (text) => ({ content: [{ type: 'text', text }], isError: true });
const imageContent = (imageBuffer, mimeType) => ({
  content: [{ type: 'image', data: imageBuffer.toString('base64'), mimeType }],
});

// Create an instance of the MCP server
const server = new McpServer(
  {
    name: 'dicomweb-mcp-server',
    title: 'DICOMweb Medical Image and Report Explorer',
    description:
      'Search and retrieve medical imaging data from a DICOMweb-compliant server. Supports querying studies, series, and instances; reading DICOM metadata; extracting Structured Report text; and rendering instance frames as images.',
    version: '0.0.3',
  },
  {
    capabilities: {
      logging: {},
      tools: {},
    },
  }
);

// Register tools with the server
server.tool(
  'find-studies',
  'Searches DICOM studies on the configured DICOMweb server. Returns studies sorted by study date, newest first. Does not retrieve series, instances, or image data.',
  {
    query: z
      .string()
      .max(1000, 'Query string must not exceed 1000 characters')
      .describe(
        'Space-separated DICOM key=value search filters. Keys are DICOM keyword names or 8-digit hex tags (e.g., PatientName=Doe* StudyDate=20200101-20201231 ModalitiesInStudy=CT 00100020=12345). Special keys: fuzzymatching=true, limit=N, offset=N. Pass an empty string to return all studies.'
      ),
  },
  async ({ query }) => {
    let textResult = 'No studies found matching the search criteria.';
    try {
      // Log the search criteria
      server.sendLoggingMessage({
        level: 'info',
        data: `Searching studies with query: ${query}`,
      });

      // Perform the search using the provided parameters
      const studies = await searchStudies(query, process.env);

      // Log the search results
      server.sendLoggingMessage({
        level: 'info',
        data: `Found ${studies.length} studies matching the search criteria.`,
      });

      // Format the search results into a human-readable text format
      if (studies.length > 0) {
        textResult = formatResults(studies, 'Study');
      }
    } catch (error) {
      const err = `Error searching studies: ${error.message}`;
      server.sendLoggingMessage({ level: 'error', data: err });

      return errorContent(err);
    }

    return textContent(textResult);
  }
);

server.tool(
  'find-series',
  'Searches DICOM series within a single study. Returns series sorted by series date, newest first. Does not retrieve instances or image data. Requires a Study Instance UID from find-studies.',
  {
    studyInstanceUid: studyUidSchema,
    query: z
      .string()
      .max(1000, 'Query string must not exceed 1000 characters')
      .describe(
        'Space-separated DICOM key=value search filters. Keys are DICOM keyword names or 8-digit hex tags (e.g., Modality=MR SeriesDescription=CHEST). Special keys: limit=N, offset=N. Pass an empty string to return all series.'
      ),
  },
  async ({ studyInstanceUid, query }) => {
    let textResult = 'No series found matching the search criteria.';
    try {
      // Log the search criteria
      server.sendLoggingMessage({
        level: 'info',
        data: `Searching series for studyInstanceUid: ${studyInstanceUid} with query: ${query}`,
      });

      // Perform the search using the provided parameters
      const series = await searchSeries(studyInstanceUid, query, process.env);

      // Log the search results
      server.sendLoggingMessage({
        level: 'info',
        data: `Found ${series.length} series matching the search criteria.`,
      });

      // Format the search results into a human-readable text format
      if (series.length > 0) {
        textResult = formatResults(series, 'Series');
      }
    } catch (error) {
      const err = `Error searching series: ${error.message}`;
      server.sendLoggingMessage({ level: 'error', data: err });

      return errorContent(err);
    }

    return textContent(textResult);
  }
);

server.tool(
  'find-instances',
  'Searches DICOM instances within a single series, sorted by Instance Number ascending. Requires Study and Series Instance UIDs from find-studies and find-series.',
  {
    studyInstanceUid: studyUidSchema,
    seriesInstanceUid: seriesUidSchema,
    query: z
      .string()
      .max(1000, 'Query string must not exceed 1000 characters')
      .describe(
        'Space-separated DICOM key=value search filters. Keys are DICOM keyword names or 8-digit hex tags (e.g., SOPClassUID=1.2.840.10008.5.1.4.1.1.2). Special keys: limit=N, offset=N. Pass an empty string to return all instances.'
      ),
  },
  async ({ studyInstanceUid, seriesInstanceUid, query }) => {
    let textResult = 'No instances found matching the search criteria.';
    try {
      // Log the search criteria
      server.sendLoggingMessage({
        level: 'info',
        data: `Searching instances for studyInstanceUid: ${studyInstanceUid}, seriesInstanceUid: ${seriesInstanceUid} with query: ${query}`,
      });

      // Perform the search using the provided parameters
      const instances = await searchInstances(
        studyInstanceUid,
        seriesInstanceUid,
        query,
        process.env
      );

      // Log the search results
      server.sendLoggingMessage({
        level: 'info',
        data: `Found ${instances.length} instances matching the search criteria.`,
      });

      // Format the search results into a human-readable text format
      if (instances.length > 0) {
        textResult = formatResults(instances, 'Instance');
      }
    } catch (error) {
      const err = `Error searching instances: ${error.message}`;
      server.sendLoggingMessage({ level: 'error', data: err });

      return errorContent(err);
    }

    return textContent(textResult);
  }
);

server.tool(
  'find-structured-reports',
  'Finds all Structured Report (SR) DICOM instances in a study by searching for SR-modality series and filtering by SR SOP Class UIDs. Requires a Study Instance UID from find-studies.',
  {
    studyInstanceUid: studyUidSchema,
  },
  async ({ studyInstanceUid }) => {
    let textResult = 'No structured reports found in this study.';
    try {
      // Log the search criteria
      server.sendLoggingMessage({
        level: 'info',
        data: `Searching structured reports for studyInstanceUid: ${studyInstanceUid}`,
      });

      // Perform the search using the provided parameters
      const reports = await searchStructuredReports(studyInstanceUid, process.env);

      // Log the search results
      server.sendLoggingMessage({
        level: 'info',
        data: `Found ${reports.length} structured reports.`,
      });

      // Format the search results into a human-readable text format
      if (reports.length > 0) {
        textResult = formatResults(reports, 'Report');
      }
    } catch (error) {
      const err = `Error searching structured reports: ${error.message}`;
      server.sendLoggingMessage({ level: 'error', data: err });

      return errorContent(err);
    }

    return textContent(textResult);
  }
);

server.tool(
  'find-encapsulated-pdf-reports',
  'Finds all Encapsulated PDF DICOM instances in a study by searching for DOC-modality series and filtering by EP SOP Class UIDs. Requires a Study Instance UID from find-studies.',
  {
    studyInstanceUid: studyUidSchema,
  },
  async ({ studyInstanceUid }) => {
    let textResult = 'No encapsulated PDF reports found in this study.';
    try {
      // Log the search criteria
      server.sendLoggingMessage({
        level: 'info',
        data: `Searching encapsulated PDF reports for studyInstanceUid: ${studyInstanceUid}`,
      });

      // Perform the search using the provided parameters
      const reports = await searchEncapsulatedPdfReports(studyInstanceUid, process.env);

      // Log the search results
      server.sendLoggingMessage({
        level: 'info',
        data: `Found ${reports.length} encapsulated PDF reports.`,
      });

      // Format the search results into a human-readable text format
      if (reports.length > 0) {
        textResult = formatResults(reports, 'Report');
      }
    } catch (error) {
      const err = `Error searching encapsulated PDF reports: ${error.message}`;
      server.sendLoggingMessage({ level: 'error', data: err });

      return errorContent(err);
    }

    return textContent(textResult);
  }
);

server.tool(
  'get-structured-report-text',
  'Retrieves and converts a Structured Report (SR) instance to human-readable text. Requires Study, Series, and SOP Instance UIDs from find-structured-reports. Does not retrieve image data.',
  {
    studyInstanceUid: studyUidSchema.describe(
      'DICOM Study Instance UID (e.g., 1.2.840.113619.2.55.3). Obtain from find-studies or find-structured-reports.'
    ),
    seriesInstanceUid: seriesUidSchema.describe(
      'DICOM Series Instance UID (e.g., 1.2.840.113619.2.55.3.604688123). Obtain from find-series or find-structured-reports.'
    ),
    sopInstanceUid: sopUidSchema.describe(
      'DICOM SOP Instance UID (e.g., 1.2.840.113619.2.55.3.604688123.123.1591781234.469). Obtain from find-instances or find-structured-reports.'
    ),
  },
  async ({ studyInstanceUid, seriesInstanceUid, sopInstanceUid }) => {
    let textResult;
    try {
      // Log the retrieval criteria
      server.sendLoggingMessage({
        level: 'info',
        data: `Retrieving structured report text for studyInstanceUid: ${studyInstanceUid}, seriesInstanceUid: ${seriesInstanceUid}, sopInstanceUid: ${sopInstanceUid}`,
      });

      // Perform the retrieval using the provided parameters
      textResult = await getStructuredReportText(
        studyInstanceUid,
        seriesInstanceUid,
        sopInstanceUid,
        process.env
      );

      // Log the successful retrieval
      server.sendLoggingMessage({
        level: 'info',
        data: `Successfully retrieved structured report text for SOP Instance UID: ${sopInstanceUid}`,
      });
    } catch (error) {
      const err = `Error retrieving structured report text: ${error.message}`;
      server.sendLoggingMessage({ level: 'error', data: err });

      return errorContent(err);
    }

    return textContent(textResult);
  }
);

server.tool(
  'get-encapsulated-pdf-report-text',
  'Retrieves and converts an Encapsulated PDF instance to human-readable text. Requires Study, Series, and SOP Instance UIDs from find-encapsulated-pdf-reports. Does not retrieve image data.',
  {
    studyInstanceUid: studyUidSchema.describe(
      'DICOM Study Instance UID (e.g., 1.2.840.113619.2.55.3). Obtain from find-studies or find-encapsulated-pdf-reports.'
    ),
    seriesInstanceUid: seriesUidSchema.describe(
      'DICOM Series Instance UID (e.g., 1.2.840.113619.2.55.3.604688123). Obtain from find-series or find-encapsulated-pdf-reports.'
    ),
    sopInstanceUid: sopUidSchema.describe(
      'DICOM SOP Instance UID (e.g., 1.2.840.113619.2.55.3.604688123.123.1591781234.469). Obtain from find-instances or find-encapsulated-pdf-reports.'
    ),
  },
  async ({ studyInstanceUid, seriesInstanceUid, sopInstanceUid }) => {
    let textResult;
    try {
      // Log the retrieval criteria
      server.sendLoggingMessage({
        level: 'info',
        data: `Retrieving encapsulated PDF report text for studyInstanceUid: ${studyInstanceUid}, seriesInstanceUid: ${seriesInstanceUid}, sopInstanceUid: ${sopInstanceUid}`,
      });

      // Perform the retrieval using the provided parameters
      textResult = await getEncapsulatedPdfReportText(
        studyInstanceUid,
        seriesInstanceUid,
        sopInstanceUid,
        process.env
      );

      // Log the successful retrieval
      server.sendLoggingMessage({
        level: 'info',
        data: `Successfully retrieved encapsulated PDF report text for SOP Instance UID: ${sopInstanceUid}`,
      });
    } catch (error) {
      const err = `Error retrieving encapsulated PDF report text: ${error.message}`;
      server.sendLoggingMessage({ level: 'error', data: err });

      return errorContent(err);
    }

    return textContent(textResult);
  }
);

server.tool(
  'get-instance-metadata',
  'Retrieves and converts a DICOM instance to human-readable text. Requires Study, Series, and SOP Instance UIDs from find-instances. Does not retrieve image data.',
  {
    studyInstanceUid: studyUidSchema,
    seriesInstanceUid: seriesUidSchema,
    sopInstanceUid: sopUidSchema,
  },
  async ({ studyInstanceUid, seriesInstanceUid, sopInstanceUid }) => {
    let textResult;
    try {
      // Log the retrieval criteria
      server.sendLoggingMessage({
        level: 'info',
        data: `Retrieving instance metadata for studyInstanceUid: ${studyInstanceUid}, seriesInstanceUid: ${seriesInstanceUid}, sopInstanceUid: ${sopInstanceUid}`,
      });

      // Perform the retrieval using the provided parameters
      const metadata = await getInstanceMetadata(
        studyInstanceUid,
        seriesInstanceUid,
        sopInstanceUid,
        process.env
      );
      textResult = formatResults(metadata, 'Metadata');

      // Log the successful retrieval
      server.sendLoggingMessage({
        level: 'info',
        data: `Successfully retrieved instance metadata for SOP Instance UID: ${sopInstanceUid}`,
      });
    } catch (error) {
      const err = `Error retrieving instance metadata: ${error.message}`;
      server.sendLoggingMessage({ level: 'error', data: err });

      return errorContent(err);
    }

    return textContent(textResult);
  }
);

server.tool(
  'render-instance-frame',
  'Renders a specific frame from a DICOM instance to an image format. Requires Study, Series, and SOP Instance UIDs from find-instances, and a frame number. Returns the rendered image as a base64-encoded string.',
  {
    studyInstanceUid: studyUidSchema,
    seriesInstanceUid: seriesUidSchema,
    sopInstanceUid: sopUidSchema,
    frame: z
      .number()
      .int()
      .positive()
      .default(1)
      .describe('1-based index of the frame to render (e.g., 1 for the first frame)'),
    outputFormat: z
      .enum(['image/jpeg', 'image/png'])
      .default('image/jpeg')
      .describe('Desired MIME type for the rendered output (e.g., image/jpeg)'),
  },
  async ({ studyInstanceUid, seriesInstanceUid, sopInstanceUid, frame, outputFormat }) => {
    try {
      // Log the rendering criteria
      server.sendLoggingMessage({
        level: 'info',
        data: `Rendering instance frame for studyInstanceUid: ${studyInstanceUid}, seriesInstanceUid: ${seriesInstanceUid}, sopInstanceUid: ${sopInstanceUid}, frame: ${frame}, outputFormat: ${outputFormat}`,
      });

      // Perform the rendering using the provided parameters
      const imageResult = await renderInstanceFrame(
        studyInstanceUid,
        seriesInstanceUid,
        sopInstanceUid,
        frame,
        outputFormat,
        process.env
      );

      // Log the successful rendering
      server.sendLoggingMessage({
        level: 'info',
        data: `Successfully rendered instance frame for SOP Instance UID: ${sopInstanceUid}, frame: ${frame}`,
      });

      return imageContent(imageResult, outputFormat);
    } catch (error) {
      const err = `Error rendering instance frame: ${error.message}`;
      server.sendLoggingMessage({ level: 'error', data: err });

      return errorContent(err);
    }
  }
);

// Connect the server to the transport layer
const transport = new StdioServerTransport();
await server.connect(transport);
