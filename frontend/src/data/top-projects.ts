export type TopProject = {
  id: number;
  name: string;
  area: string;
  team: string;
  desc: string;
  votes: number;
  rating: number;
  type: string;
  comments?: Array<{ user: string; text: string; rating: number }>;
  isSeed?: boolean;
};

export const topProjects: TopProject[] = [
  { id: 1, name: "SmartCampus", area: "IoT", team: "João, Maria, Pedro", desc: "Monitoramento inteligente do campus com sensores IoT.", votes: 24, rating: 4.2, type: "projeto", comments: [], isSeed: true },
  { id: 2, name: "TeleHealth Angola", area: "Telecom", team: "Ana, Carlos", desc: "Telemedicina para zonas rurais usando redes de baixa latência.", votes: 31, rating: 4.5, type: "projeto", comments: [], isSeed: true },
  { id: 3, name: "SecureNet", area: "Segurança", team: "Luís, Sofia, Tiago", desc: "Detecção de intrusões em redes corporativas.", votes: 18, rating: 3.8, type: "projeto", comments: [], isSeed: true },
  { id: 4, name: "EduConnect", area: "Web", team: "Rita, Manuel", desc: "Plataforma de aprendizagem colaborativa.", votes: 22, rating: 4.0, type: "projeto", comments: [], isSeed: true },
  { id: 5, name: "GreenGrid", area: "IA", team: "André, Beatriz", desc: "Optimização de consumo energético com IA.", votes: 27, rating: 4.3, type: "projeto", comments: [], isSeed: true },
  { id: 6, name: "Angola Fresh", area: "Alimentação", team: "Carla, Bruno", desc: "Entrega de produtos frescos com logística inteligente.", votes: 20, rating: 4.1, type: "negocio", comments: [], isSeed: true },
  { id: 7, name: "TechRepair Kit", area: "Hardware", team: "David, Helena", desc: "Kit portátil de reparação de equipamentos electrónicos.", votes: 16, rating: 3.9, type: "produto", comments: [], isSeed: true },
  { id: 8, name: "QuickPay AO", area: "Tecnologia", team: "Filipe, Graça", desc: "Solução de pagamentos móveis para mercados informais.", votes: 25, rating: 4.4, type: "negocio", comments: [], isSeed: true },
];
