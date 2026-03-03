import xlsx from 'xlsx';

const workbook = xlsx.readFile('Iniciativas_Consolidadas_20260303_v02.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Sheet Name:", sheetName);
console.log("Headers:");
console.log(data[0]);
console.log("Sample Row:");
console.log(data[1]);
