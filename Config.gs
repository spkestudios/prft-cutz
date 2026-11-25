// Edita estos valores y publica una versión nueva de la misma implementación.
const PELU = {
  nombre: 'Peluquería',
  zona: 'Europe/Madrid',
  servicios: [
    { id: 'corte', nombre: 'Corte de pelo', minutos: 30, precio: 10 },
    { id: 'barba', nombre: 'Barba', minutos: 15, precio: 5 },
    { id: 'completo', nombre: 'Corte y barba', minutos: 45, precio: 13 }
  ],
  // Precio en euros: null muestra «A consultar». Para decimales, usa 12.50.
  // 0 = domingo, 1 = lunes, ... 6 = sábado. [] cierra el día.
  horario: {
    0: [],
    1: [['10:00', '14:00'], ['16:00', '20:00']],
    2: [['10:00', '14:00'], ['16:00', '20:00']],
    3: [['10:00', '14:00'], ['16:00', '20:00']],
    4: [['10:00', '14:00'], ['16:00', '20:00']],
    5: [['10:00', '14:00'], ['16:00', '20:00']],
    6: [['10:00', '14:00']]
  },
  diasPorAdelantado: 60
};
