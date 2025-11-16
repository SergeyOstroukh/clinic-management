// Расчет общей стоимости услуг
export const calculateServicesTotal = (services, allServices) => {
  if (!services || services.length === 0) return 0;
  return services.reduce((sum, s) => {
    const service = allServices.find(serv => serv.id === s.service_id);
    return sum + (service ? service.price * s.quantity : 0);
  }, 0);
};

// Расчет общей стоимости материалов
export const calculateMaterialsTotal = (materials, allMaterials) => {
  if (!materials || materials.length === 0) return 0;
  return materials.reduce((sum, m) => {
    const material = allMaterials.find(mat => mat.id === m.material_id);
    return sum + (material ? material.price * m.quantity : 0);
  }, 0);
};

// Применение скидки
export const applyDiscount = (total, discountType, discountValue) => {
  if (!discountValue || parseFloat(discountValue) <= 0) {
    return { discountAmount: 0, finalTotal: total };
  }

  const discountVal = parseFloat(discountValue);
  let discountAmount = 0;

  if (discountType === 'percent') {
    discountAmount = (total * discountVal) / 100;
  } else {
    discountAmount = discountVal;
  }

  if (discountAmount > total) {
    discountAmount = total;
  }

  return {
    discountAmount,
    finalTotal: total - discountAmount
  };
};

// Расчет сдачи
export const calculateChange = (paidAmount, totalAmount) => {
  const paid = parseFloat(paidAmount) || 0;
  const change = paid - totalAmount;
  return {
    change,
    isEnough: change >= 0
  };
};

