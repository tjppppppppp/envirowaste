// SYNTHETIC DEMONSTRATION MAPPINGS — NOT ACTUAL UIUC TRUCKS, ROUTES, WORK ORDERS OR DISPOSAL RULES.
// Edit this list to change the demonstration. Real mappings are not configured: until F&S authorizes and supplies them,
// project-mode entries are entered manually and their work order stays unknown.
export type DemoRoute = { id: string; label: string; material: string; workOrder: string | null; disposal: string };
export type DemoTruck = { id: string; label: string; routes: DemoRoute[] };
export const DEMO_TRUCKS: DemoTruck[] = [
  { id: "DEMO-T1", label: "DEMO Truck 1 (synthetic)", routes: [
    { id: "DEMO-R-A", label: "DEMO Route A — Alpha cluster", material: "Mixed recycling", workOrder: "DEMO-WO-1001", disposal: "DEMO Recycling Facility (synthetic)" },
    { id: "DEMO-R-B", label: "DEMO Route B — Bravo cluster", material: "Cardboard", workOrder: "DEMO-WO-1002", disposal: "DEMO Recycling Facility (synthetic)" },
  ] },
  { id: "DEMO-T2", label: "DEMO Truck 2 (synthetic)", routes: [
    { id: "DEMO-R-C", label: "DEMO Route C — Charlie cluster", material: "Landfill waste", workOrder: "DEMO-WO-2001", disposal: "DEMO Landfill (synthetic)" },
    { id: "DEMO-R-D", label: "DEMO Route D — Delta cluster", material: "Food waste / compost", workOrder: null, disposal: "DEMO Compost Site (synthetic)" },
  ] },
  { id: "DEMO-T3", label: "DEMO Truck 3 (synthetic)", routes: [
    { id: "DEMO-R-E", label: "DEMO Route E — Echo cluster", material: "Landfill waste", workOrder: null, disposal: "DEMO Landfill (synthetic)" },
  ] },
];
export const MATERIALS = ["Mixed recycling", "Cardboard", "Landfill waste", "Food waste / compost", "Other"];
