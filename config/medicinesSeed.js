// server/config/medicinesSeed.js
// Hàm seed dữ liệu cho bảng Medicines
module.exports = async function seedMedicines(models, transaction, context = {}) {
  const thuocCategory = context.thuocCategory;
  if (!thuocCategory) throw new Error('medicinesSeed requires thuocCategory');
  const meds = [
    { name: 'Paracetamol', composition: 'Acetaminophen 500mg', uses: 'Giảm đau, hạ sốt', side_effects: 'Buồn nôn, phát ban', manufacturer: 'Sanofi' },
    { name: 'Amoxicillin', composition: 'Amoxicillin 500mg', uses: 'Kháng sinh phổ rộng', side_effects: 'Tiêu chảy, dị ứng', manufacturer: 'GSK' },
    { name: 'Ibuprofen', composition: 'Ibuprofen 200mg', uses: 'Chống viêm, giảm đau', side_effects: 'Đau dạ dày', manufacturer: 'Bayer' },
    { name: 'Aspirin', composition: 'Acetylsalicylic acid 81mg', uses: 'Giảm đau, phòng ngừa huyết khối', side_effects: 'Chảy máu dạ dày', manufacturer: 'Bayer' },
    { name: 'Metformin', composition: 'Metformin 500mg', uses: 'Kiểm soát đường huyết', side_effects: 'Tiêu chảy, buồn nôn', manufacturer: 'Merck' },
    { name: 'Atorvastatin', composition: 'Atorvastatin 20mg', uses: 'Hạ mỡ máu', side_effects: 'Đau cơ', manufacturer: 'Pfizer' },
    { name: 'Omeprazole', composition: 'Omeprazole 20mg', uses: 'Giảm acid dạ dày', side_effects: 'Đau đầu', manufacturer: 'AstraZeneca' },
    { name: 'Cetirizine', composition: 'Cetirizine 10mg', uses: 'Chống dị ứng', side_effects: 'Buồn ngủ', manufacturer: 'UCB' },
    { name: 'Loratadine', composition: 'Loratadine 10mg', uses: 'Chống dị ứng', side_effects: 'Khô miệng', manufacturer: 'Claritin' },
    { name: 'Ceftriaxone', composition: 'Ceftriaxone 1g', uses: 'Kháng sinh tiêm', side_effects: 'Phản ứng tại chỗ', manufacturer: 'Roche' },
    { name: 'Azithromycin', composition: 'Azithromycin 500mg', uses: 'Kháng sinh', side_effects: 'Tiêu chảy', manufacturer: 'Pfizer' },
    { name: 'Hydrochlorothiazide', composition: 'HCTZ 25mg', uses: 'Lợi tiểu, điều trị tăng huyết áp', side_effects: 'Hạ kali máu', manufacturer: 'Sandoz' },
    { name: 'Losartan', composition: 'Losartan 50mg', uses: 'Hạ huyết áp', side_effects: 'Chóng mặt', manufacturer: 'Merck' },
    { name: 'Salbutamol', composition: 'Salbutamol inhaler', uses: 'Giãn phế quản', side_effects: 'Run', manufacturer: 'GlaxoSmithKline' },
    { name: 'Prednisone', composition: 'Prednisone 5mg', uses: 'Kháng viêm corticosteroid', side_effects: 'Tăng cân', manufacturer: 'Pfizer' },
    { name: 'Warfarin', composition: 'Warfarin sodium', uses: 'Chống đông máu', side_effects: 'Chảy máu', manufacturer: 'Bristol-Myers Squibb' },
    { name: 'Enalapril', composition: 'Enalapril 10mg', uses: 'Hạ huyết áp', side_effects: 'Ho khan', manufacturer: 'Merck' },
    { name: 'Fluconazole', composition: 'Fluconazole 150mg', uses: 'Điều trị nấm', side_effects: 'Rối loạn tiêu hóa', manufacturer: 'Pfizer' },
    { name: 'Insulin (regular)', composition: 'Human insulin', uses: 'Điều trị đái tháo đường', side_effects: 'Hạ đường huyết', manufacturer: 'Novo Nordisk' },
    { name: 'Morphine', composition: 'Morphine sulfate', uses: 'Giảm đau nặng', side_effects: 'Buồn ngủ, nghiện', manufacturer: 'Mallinckrodt' }
  ];

  const medicines = await models.Medicine.bulkCreate(meds.map(m => ({
    category_id: thuocCategory.id,
    name: m.name,
    composition: m.composition,
    uses: m.uses,
    side_effects: m.side_effects,
    manufacturer: m.manufacturer,
    slug: m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    created_at: new Date(),
    updated_at: new Date()
  })), { transaction });

  return medicines;
};