# 🎯 HƯỚNG DẪN CẬP NHẬT DIỄN ĐÀN - ANONYMOUS & MULTI-SPECIALTY

## 📋 Tổng quan các thay đổi

### 1. **Thống kê Banner** ✅
- **Trước**: Hiển thị số chuyên khoa
- **Sau**: Hiển thị số chủ đề (topicCount)
- Files đã sửa:
  - `server/controllers/forumController.js` - getForumOverview()
  - `client/src/components/ForumBanner.js`

### 2. **Tách riêng Topic và Specialty** ✅
- **Topic**: Chủ đề chính (10-15 chủ đề), **BẮT BUỘC** khi đăng bài
- **Specialty**: Chuyên khoa, **KHÔNG BẮT BUỘC**, có thể chọn **NHIỀU**
- Seed file mới: `server/config/forumTopicsSeed.js`

### 3. **Model Question - Fields mới** ✅
```javascript
{
  specialtyIds: JSON[], // Array of specialty IDs - chọn nhiều
  attachments: JSON[],  // Files đính kèm - tối đa 5
  anonymousCode: STRING(10), // Mã ẩn danh 5 ký tự (VD: A3X9K)
  isAnonymous: BOOLEAN  // Đã có sẵn
}
```

### 4. **Chức năng Ẩn danh** ✅
**Quy tắc:**
- Chỉ cho phép khi topic có `requiresApproval = true`
- Tạo mã random 5 ký tự (unique)
- Admin/Manager topic/Author → Thấy tên thật
- User khác → Thấy "Người dùng ẩn danh A3X9K"
- Notification cho moderator có hiển thị mã ẩn danh

### 5. **Form đăng bài mới** ⚠️ CẦN LÀM
**Trường BẮT BUỘC:**
- ✅ Tiêu đề (title)
- ✅ Nội dung (content)
- ✅ Chủ đề (topicId)

**Trường KHÔNG BẮT BUỘC:**
- Chuyên khoa (specialtyIds) - **Chọn nhiều**
- Hình ảnh (images)
- Files đính kèm (attachments) - **Tối đa 5**
- Tags (tags)
- Ẩn danh (isAnonymous) - **Chỉ hiện khi topic có phê duyệt**

---

## 🚀 Các bước thực hiện

### **Bước 1: Chạy Migration** ⚠️ BẮT BUỘC
```bash
cd server
node run-migration-008.js
```

Migration sẽ:
- Thêm cột `anonymous_code`
- Thêm cột `specialty_ids` (JSON)
- Thêm cột `attachments` (JSON)
- Migrate data cũ: `specialty_id` → `specialty_ids` array

### **Bước 2: Seed Topics** ⚠️ BẮT BUỘC
```bash
cd server
node -e "require('./config/forumTopicsSeed')();"
```

Hoặc gộp vào seed chung trong `app.js`:
```javascript
const seedForumTopics = require('./config/forumTopicsSeed');
await seedForumTopics();
```

### **Bước 3: Kiểm tra Backend API** ✅ ĐÃ XONG

**API POST /forum/questions - Request Body:**
```json
{
  "title": "Tiêu đề câu hỏi",
  "content": "Nội dung chi tiết...",
  "topicId": 1,
  "specialtyIds": [2, 5],  // Mảng - có thể rỗng
  "tags": ["tag1", "tag2"],
  "images": ["url1", "url2"],
  "attachments": ["file1.pdf", "file2.doc"],  // Tối đa 5
  "isAnonymous": true  // Chỉ được true nếu topic requiresApproval=true
}
```

**Response khi tạo thành công:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "status": "pending",  // hoặc "approved"
    "message": "Câu hỏi đang chờ duyệt"
  }
}
```

**API GET /forum/questions/:id - Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "title": "...",
    "author": {
      "id": null,  // null nếu user không có quyền xem
      "full_name": "Người dùng ẩn danh A3X9K",  // Hoặc tên thật
      "avatar_url": null,
      "isAnonymous": true,
      "anonymousCode": "A3X9K"  // Chỉ có khi admin/manager xem
    },
    "specialtyIds": [2, 5],
    "attachments": ["file1.pdf"],
    "isAnonymous": true,
    // ... các field khác
  }
}
```

---

## 🎨 Frontend cần cập nhật

### **1. Form đăng câu hỏi** (`ForumPage.js` modal) ⚠️ CẦN LÀM

**Cấu trúc form mới:**
```jsx
<form onSubmit={handleCreateQuestion}>
  {/* 1. Tiêu đề - BẮT BUỘC */}
  <input required name="title" placeholder="Tiêu đề câu hỏi" />
  
  {/* 2. Nội dung - BẮT BUỘC */}
  <textarea required name="content" placeholder="Mô tả chi tiết..." />
  
  {/* 3. Chủ đề - BẮT BUỘC */}
  <select required name="topicId">
    <option value="">-- Chọn chủ đề --</option>
    {topics.map(t => <option value={t.id}>{t.name}</option>)}
  </select>
  
  {/* 4. Chuyên khoa - KHÔNG BẮT BUỘC - CHỌN NHIỀU */}
  <div className="multi-select">
    <label>Chuyên khoa (không bắt buộc)</label>
    {specialties.map(s => (
      <label key={s.id}>
        <input 
          type="checkbox" 
          value={s.id}
          checked={selectedSpecialties.includes(s.id)}
          onChange={handleSpecialtyToggle}
        />
        {s.name}
      </label>
    ))}
  </div>
  
  {/* 5. Hình ảnh - KHÔNG BẮT BUỘC */}
  <input type="file" multiple accept="image/*" onChange={handleImageUpload} />
  
  {/* 6. Files đính kèm - KHÔNG BẮT BUỘC - TỐI ĐA 5 */}
  <input 
    type="file" 
    multiple 
    accept=".pdf,.doc,.docx,.xls,.xlsx"
    onChange={handleFileUpload}
    disabled={attachments.length >= 5}
  />
  <small>Tối đa 5 files</small>
  
  {/* 7. Tags - KHÔNG BẮT BUỘC */}
  <input name="tags" placeholder="Tags (phân cách bởi dấu phẩy)" />
  
  {/* 8. Ẩn danh - CHỈ HIỆN KHI TOPIC CÓ PHÊDUYỆT */}
  {selectedTopic && selectedTopic.requiresApproval && (
    <label className="anonymous-checkbox">
      <input 
        type="checkbox" 
        checked={isAnonymous}
        onChange={(e) => setIsAnonymous(e.target.checked)}
      />
      Đăng ẩn danh (Chỉ admin/quản lý mới thấy tên bạn)
    </label>
  )}
  
  <button type="submit">Gửi câu hỏi</button>
</form>
```

**Logic submit:**
```javascript
const handleCreateQuestion = async (e) => {
  e.preventDefault();
  
  const formData = {
    title: e.target.title.value.trim(),
    content: e.target.content.value.trim(),
    topicId: parseInt(e.target.topicId.value),
    specialtyIds: selectedSpecialties, // Array of IDs
    tags: e.target.tags.value.split(',').map(t => t.trim()).filter(Boolean),
    images: uploadedImages, // Array of URLs
    attachments: uploadedFiles, // Array of URLs - max 5
    isAnonymous: isAnonymous
  };
  
  try {
    const res = await api.post('/forum/questions', formData);
    if (res.data.success) {
      alert(res.data.data.message);
      setShowModal(false);
      fetchQuestions(); // Reload danh sách
    }
  } catch (error) {
    alert(error.response?.data?.message || 'Lỗi tạo câu hỏi');
  }
};
```

### **2. Hiển thị author trong QuestionDetailPage** ⚠️ CẦN LÀM

```jsx
// Hiển thị author
{question.author && (
  <div className="author-info">
    {question.author.avatar_url ? (
      <img src={question.author.avatar_url} alt="" />
    ) : (
      <div className="avatar-placeholder">
        {question.author.isAnonymous ? '?' : question.author.full_name[0]}
      </div>
    )}
    <span className={question.author.isAnonymous ? 'anonymous' : ''}>
      {question.author.full_name}
      {question.author.isAnonymous && user && (user.role === 'admin' || canManageTopic) && (
        <span className="admin-only"> (Mã: {question.author.anonymousCode})</span>
      )}
    </span>
  </div>
)}
```

### **3. Hiển thị specialties nhiều** ⚠️ CẦN LÀM

```jsx
{/* Thay vì 1 specialty, giờ hiển thị array */}
{question.specialtyIds && question.specialtyIds.length > 0 && (
  <div className="specialties-list">
    {question.specialtyIds.map(specId => {
      const spec = specialties.find(s => s.id === specId);
      return spec ? (
        <span key={specId} className="specialty-badge">
          {spec.name}
        </span>
      ) : null;
    })}
  </div>
)}
```

### **4. Hiển thị files đính kèm** ⚠️ CẦN LÀM

```jsx
{question.attachments && question.attachments.length > 0 && (
  <div className="attachments-list">
    <h4>📎 Files đính kèm:</h4>
    {question.attachments.map((file, index) => (
      <a 
        key={index} 
        href={file} 
        target="_blank" 
        rel="noopener noreferrer"
        className="attachment-link"
      >
        📄 {file.split('/').pop()}
      </a>
    ))}
  </div>
)}
```

---

## ✅ Checklist hoàn thành

### Backend ✅
- [x] Cập nhật model Question (anonymousCode, specialtyIds, attachments)
- [x] Tạo migration 008
- [x] Seed file forumTopicsSeed.js
- [x] Cập nhật createQuestion controller
- [x] Cập nhật getQuestionDetail controller (anonymous handling)
- [x] Cập nhật getForumOverview (topicCount thay vì specialtyCount)
- [x] Validation: isAnonymous chỉ khi requiresApproval=true

### Frontend ⚠️ CẦN LÀM
- [ ] Cập nhật ForumBanner.js (đã xong stats)
- [ ] **Cập nhật form đăng bài trong ForumPage.js:**
  - [ ] Dropdown chọn topic (bắt buộc)
  - [ ] Multi-select chuyên khoa (không bắt buộc)
  - [ ] Upload files (tối đa 5)
  - [ ] Checkbox ẩn danh (chỉ hiện khi topic có phê duyệt)
- [ ] **Cập nhật QuestionDetailPage.js:**
  - [ ] Hiển thị author ẩn danh đúng
  - [ ] Hiển thị nhiều specialties
  - [ ] Hiển thị files đính kèm
- [ ] Fetch topics từ API `/forum/topics`
- [ ] CSS cho multi-select specialties
- [ ] CSS cho attachment list

---

## 🐛 Lưu ý quan trọng

1. **Chạy migration trước khi start server:** `node run-migration-008.js`
2. **Seed topics:** `node -e "require('./config/forumTopicsSeed')();"`
3. **Kiểm tra role user:** Admin/Manager topic mới thấy tên thật khi anonymous
4. **Validate files:** Frontend phải check tối đa 5 attachments
5. **Check topic.requiresApproval:** Chỉ hiện checkbox ẩn danh khi topic cần phê duyệt

---

## 📞 Support

Nếu gặp lỗi:
1. Check console log server
2. Check network tab trong browser
3. Verify migration đã chạy: `SELECT * FROM questions LIMIT 1;` - phải có cột mới
4. Verify topics đã seed: `SELECT * FROM topics;` - phải có 15 topics

