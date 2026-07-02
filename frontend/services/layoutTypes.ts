export interface LabRota {
  rota: string;
  tipo: string;
  execucao: string;
  zona: string;
  x: number;
  y: number;
}

export interface LabZone {
  nome: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface LabLayout {
  canvas: { width: number; height: number };
  backgroundImage?: string;
  stationWidth: number;
  stationHeight: number;
  zones: LabZone[];
  rotas: LabRota[];
}
