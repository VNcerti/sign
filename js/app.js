new Vue({
    el: '#app',
    data: {
        // Data hiện tại
        showStep1: true,
        showStep2: false,
        showStep3: false,
        showStep4: false,
        showDirectDownload: false,
        progressBar: 0,
        uploadStep: 1,
        certZip: null,
        certZipCss: 'invalid',
        certZipText: 'Chọn file .zip chứa chứng chỉ...',
        p12: null,
        mobileprovision: null,
        password: '',
        pwdCss: 'invalid',
        jobId: '',
        statusText: '',
        logText: '',
        download: '',
        download_ipa: '',
        shareUrl: '',
        directDownloadUrl: '',
        firestoreDocId: '',
        showPasswordSuggestions: false,
        passwordSuggestions: [],
        copySuccess: false,
        isExtractingZip: false,
        uploadDetails: '',
        
        // Data mới cho phần chọn ứng dụng
        selectedApp: '',
        // CHỈ TỒN TẠI 1 BIẾN IPA DUY NHẤT - TUÂN THỦ YÊU CẦU
        ipa: null,  // Biến IPA duy nhất dùng chung cho cả auto và custom
        // Biến lưu file custom chỉ để hiển thị
        customIpaFile: null,
        appStatusText: '',
        appStatusClass: '',
        appStatusIcon: '',
        isIpaLoading: false,
        ipaUrlMap: {
            'esign': 'https://tight-water-fabbipa-proxy.tlvdzreal.workers.dev/esign',
            'gbox': 'https://tight-water-fabbipa-proxy.tlvdzreal.workers.dev/gbox',
            'sca': 'https://tight-water-fabbipa-proxy.tlvdzreal.workers.dev/scarlet'
        },
        appNames: {
            'esign': 'ESign 5.0.2',
            'gbox': 'GBox',
            'sca': 'Scarlet',
            'custom': 'IPA tùy chọn'
        },
        appSizes: {
            'esign': '',
            'gbox': '',
            'sca': ''
        },
        appStatus: {
            'esign': '', // '', 'loading', 'loaded', 'error'
            'gbox': '',
            'sca': ''
        }
    },
    computed: {
        selectedAppName() {
            return this.appNames[this.selectedApp] || '';
        },
        
        canSign() {
            console.log('=== CAN SIGN CHECK ===');
            console.log('1. IPA file:', this.ipa ? `Có (${this.ipa.name}, ${this.formatFileSize(this.ipa.size)})` : 'Không');
            console.log('2. Cert ZIP:', this.certZip ? 'Đã chọn' : 'Chưa chọn');
            console.log('3. Password:', this.password ? 'Đã nhập' : 'Chưa nhập');
            console.log('4. P12:', this.p12 ? 'Có' : 'Không');
            console.log('5. Mobileprovision:', this.mobileprovision ? 'Có' : 'Không');
            console.log('6. Selected App:', this.selectedApp || 'Không');
            
            // Validate các trường bắt buộc
            if (!this.ipa) {
                console.log('❌ Thiếu file IPA!');
                return false;
            }
            
            if (!this.certZip) {
                console.log('❌ Thiếu file ZIP chứng chỉ!');
                return false;
            }
            
            if (!this.password) {
                console.log('❌ Thiếu mật khẩu chứng chỉ!');
                return false;
            }
            
            // Check if zip extraction was successful
            if (!this.p12 || !this.mobileprovision) {
                console.log('❌ File zip không chứa đủ file cần thiết!');
                return false;
            }
            
            // Kiểm tra kích thước IPA
            if (this.ipa.size === 0) {
                console.log('❌ IPA file có kích thước = 0');
                return false;
            }
            
            console.log('✅ Đủ điều kiện ký!');
            return true;
        },
        
        signButtonText() {
            if (!this.canSign) {
                return 'Vui lòng điền đầy đủ thông tin';
            }
            
            if (this.selectedApp === 'custom') {
                return 'Ký IPA tùy chọn!';
            }
            
            if (this.selectedApp) {
                return `Ký ${this.selectedAppName}!`;
            }
            
            return 'Ký ngay!';
        }
    },
    mounted() {
        // Load password suggestions from localStorage
        this.loadPasswordSuggestions();
        
        // Check if there's a download parameter in URL
        this.checkDirectDownload();
        
        // Debug URLs
        console.log('Current URLs:', {
            SignUrl: typeof SignUrl !== 'undefined' ? SignUrl : 'Not defined',
            StatusUrl: typeof StatusUrl !== 'undefined' ? StatusUrl : 'Not defined',
            DownloadUrl: typeof DownloadUrl !== 'undefined' ? DownloadUrl : 'Not defined'
        });
    },
    methods: {
        // Format file size
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        
        // Method chọn app auto
        async selectApp(appKey) {
            console.log('Selecting auto app:', appKey);
            
            if (this.selectedApp === appKey) {
                // Nếu đang chọn lại app đang chọn, bỏ chọn
                this.clearSelectedApp();
                return;
            }
            
            // Clear custom IPA nếu có
            if (this.selectedApp === 'custom') {
                this.customIpaFile = null;
                if (this.$refs.customIpaInput) {
                    this.$refs.customIpaInput.value = '';
                }
            }
            
            // Set selected app
            this.selectedApp = appKey;
            
            // Set status loading
            this.appStatus[appKey] = 'loading';
            this.appStatusText = 'Đang tải IPA...';
            this.appStatusClass = 'loading';
            this.appStatusIcon = 'fas fa-spinner fa-spin';
            
            // Load IPA từ URL và gán vào biến ipa duy nhất
            await this.loadIpaFromUrl(appKey);
        },
        
        // Method chọn custom IPA
        selectCustomIpa() {
            console.log('Selecting custom IPA');
            
            if (this.selectedApp === 'custom') {
                // Nếu đang chọn lại, bỏ chọn
                this.clearSelectedApp();
                return;
            }
            
            // Clear app đang chọn
            this.selectedApp = 'custom';
            this.appStatusText = 'Chọn file IPA của bạn';
            this.appStatusClass = '';
            this.appStatusIcon = 'fas fa-upload';
            
            // Kích hoạt input file
            this.$nextTick(() => {
                console.log('Triggering custom IPA input click');
                this.$refs.customIpaInput.click();
            });
        },
        
        // Xử lý khi chọn custom IPA
        handleCustomIpa(event) {
            console.log('Handling custom IPA selection:', event);
            const file = event.target.files[0] || null;
            
            if (!file) {
                console.log('No file selected');
                this.clearSelectedApp();
                return;
            }
            
            // Kiểm tra file extension
            if (!file.name.toLowerCase().endsWith('.ipa')) {
                alert('Vui lòng chọn file .ipa!');
                this.clearSelectedApp();
                return;
            }
            
            // GHI NHỚ: CHỈ TỒN TẠI 1 BIẾN IPA DUY NHẤT
            // Gán file vào biến ipa duy nhất
            this.ipa = file;
            this.customIpaFile = file; // Lưu riêng để hiển thị
            
            console.log('✅ Custom IPA file saved to this.ipa:', {
                name: file.name,
                size: file.size,
                type: file.type,
                'this.ipa exists': !!this.ipa
            });
            
            // Cập nhật status
            this.appStatusText = `Đã chọn: ${file.name} (${this.formatFileSize(file.size)})`;
            this.appStatusClass = 'success';
            this.appStatusIcon = 'fas fa-check-circle';
            
            // Reset trạng thái các app auto
            this.appStatus = {
                'esign': '',
                'gbox': '',
                'sca': ''
            };
            
            // Force update
            this.$forceUpdate();
        },
        
        // Clear app đang chọn
        clearSelectedApp() {
            console.log('Clearing selected app');
            this.selectedApp = '';
            this.ipa = null; // XÓA BIẾN IPA DUY NHẤT
            this.customIpaFile = null;
            this.appStatusText = '';
            this.appStatusClass = '';
            this.appStatusIcon = '';
            
            // Reset app status
            this.appStatus = {
                'esign': '',
                'gbox': '',
                'sca': ''
            };
            
            // Reset custom input
            if (this.$refs.customIpaInput) {
                this.$refs.customIpaInput.value = '';
            }
            
            // Force update
            this.$forceUpdate();
        },
        
        loadPasswordSuggestions() {
            const savedPasswords = localStorage.getItem('ipasign_password_history');
            if (savedPasswords) {
                this.passwordSuggestions = JSON.parse(savedPasswords);
            }
        },
        
        savePasswordToHistory(password) {
            if (!password) return;
            
            // Remove password if already exists
            const index = this.passwordSuggestions.indexOf(password);
            if (index > -1) {
                this.passwordSuggestions.splice(index, 1);
            }
            
            // Add to beginning of array
            this.passwordSuggestions.unshift(password);
            
            // Keep only last 5 passwords
            if (this.passwordSuggestions.length > 5) {
                this.passwordSuggestions = this.passwordSuggestions.slice(0, 5);
            }
            
            // Save to localStorage
            localStorage.setItem('ipasign_password_history', JSON.stringify(this.passwordSuggestions));
        },
        
        selectPassword(password) {
            this.password = password;
            this.showPasswordSuggestions = false;
        },
        
        hidePasswordSuggestions() {
            // Delay hiding to allow clicking on suggestions
            setTimeout(() => {
                this.showPasswordSuggestions = false;
            }, 200);
        },
        
        checkDirectDownload() {
            const urlParams = new URLSearchParams(window.location.search);
            const downloadId = urlParams.get('download');
            
            if (downloadId) {
                this.loadFromFirestore(downloadId);
            }
        },
        
        async loadFromFirestore(docId) {
            try {
                const docRef = db.collection('signed_apps').doc(docId);
                const doc = await docRef.get();
                
                if (doc.exists) {
                    const data = doc.data();
                    this.directDownloadUrl = data.download_url;
                    this.showDirectDownload = true;
                    this.showStep1 = false;
                    this.showStep2 = false;
                    this.showStep3 = false;
                    this.showStep4 = false;
                    
                    // Generate QR code for direct download
                    setTimeout(() => {
                        new QRCode(document.getElementById('directQrcode'), {
                            width: 130,
                            height: 130,
                            colorDark: "#000000",
                            colorLight: "#ffffff",
                            correctLevel: QRCode.CorrectLevel.H
                        }).makeCode(this.directDownloadUrl);
                    }, 100);
                } else {
                    alert('Link tải không tồn tại hoặc đã hết hạn!');
                }
            } catch (error) {
                console.error('Error loading from Firestore:', error);
                alert('Có lỗi xảy ra khi tải thông tin!');
            }
        },
        
        async saveToFirestore(downloadUrl) {
            try {
                // Generate short ID (6 characters)
                const shortId = generateShortId();
                
                // Create document in Firestore with short ID
                await db.collection('signed_apps').doc(shortId).set({
                    download_url: downloadUrl,
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                    app_name: this.selectedAppName || 'Unknown App',
                    bundle_id: 'Unknown Bundle ID'
                });
                
                this.firestoreDocId = shortId;
                this.shareUrl = `${window.location.origin}${window.location.pathname}?download=${shortId}`;
                return shortId;
            } catch (error) {
                console.error('Error saving to Firestore:', error);
                return null;
            }
        },
        
        async loadIpaFromUrl(appKey) {
            try {
                this.isIpaLoading = true;
                this.appStatusText = 'Đang tải IPA...';
                this.appStatusClass = 'loading';
                this.appStatusIcon = 'fas fa-spinner fa-spin';
                
                const url = this.ipaUrlMap[appKey];
                if (!url) {
                    throw new Error('URL không tồn tại');
                }
                
                console.log(`Fetching IPA from: ${url}`);
                
                // Fetch IPA từ Cloudflare Worker với timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                
                const response = await fetch(url, {
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                // Lấy content type và filename
                const contentType = response.headers.get('content-type');
                const contentDisposition = response.headers.get('content-disposition');
                let filename = `${appKey}.ipa`;
                
                if (contentDisposition) {
                    const match = contentDisposition.match(/filename="(.+?)"/);
                    if (match) {
                        filename = match[1];
                    } else {
                        const match2 = contentDisposition.match(/filename\*=UTF-8''(.+)/);
                        if (match2) {
                            filename = decodeURIComponent(match2[1]);
                        }
                    }
                }
                
                // Convert response thành Blob
                const blob = await response.blob();
                
                if (blob.size === 0) {
                    throw new Error('IPA file rỗng (0 bytes)');
                }
                
                // Lưu kích thước file để hiển thị
                const sizeInMB = (blob.size / 1024 / 1024).toFixed(2);
                this.appSizes[appKey] = `${sizeInMB} MB`;
                
                // QUAN TRỌNG: Gán vào biến ipa duy nhất
                this.ipa = new File([blob], filename, {
                    type: contentType || 'application/octet-stream'
                });
                
                // Cập nhật status
                this.appStatus[appKey] = 'loaded';
                this.appStatusText = `Đã tải: ${this.appNames[appKey]} (${sizeInMB} MB)`;
                this.appStatusClass = 'success';
                this.appStatusIcon = 'fas fa-check-circle';
                
                console.log('✅ IPA auto-loaded to this.ipa:', {
                    name: filename,
                    size: blob.size,
                    type: this.ipa.type,
                    'this.ipa exists': !!this.ipa
                });
                
                // Force update
                this.$forceUpdate();
                
            } catch (error) {
                console.error('Lỗi tải IPA:', error);
                
                // Reset - QUAN TRỌNG: Xóa biến ipa duy nhất
                this.ipa = null;
                this.appStatus[appKey] = 'error';
                
                if (error.name === 'AbortError') {
                    this.appStatusText = 'Lỗi timeout: Tải IPA quá lâu';
                } else {
                    this.appStatusText = `Lỗi tải IPA: ${error.message}`;
                }
                
                this.appStatusClass = 'error';
                this.appStatusIcon = 'fas fa-exclamation-circle';
                
                alert(`Không thể tải IPA cho ${this.appNames[appKey] || appKey}: ${error.message}`);
                
                // Reset selected app nếu có lỗi
                this.selectedApp = '';
            } finally {
                this.isIpaLoading = false;
            }
        },
        
        async getFile(e) {
            const file = e.target.files[0] || null;
            
            if (e.target.accept === '.zip') {
                this.certZip = file;
                this.certZipCss = file ? 'valid' : 'invalid';
                this.certZipText = file ? file.name : 'Chọn file .zip chứa chứng chỉ...';
                
                // Auto extract zip file when selected
                if (file) {
                    await this.extractZipFile(file);
                }
                
                // Force update
                this.$forceUpdate();
            }
        },
        
        async extractZipFile(zipFile) {
            this.isExtractingZip = true;
            
            try {
                const zip = new JSZip();
                const zipContent = await zip.loadAsync(zipFile);
                
                let p12File = null;
                let mobileprovisionFile = null;
                
                // Find .p12 and .mobileprovision files in the zip
                for (const [filename, file] of Object.entries(zipContent.files)) {
                    if (!file.dir) {
                        if (filename.toLowerCase().endsWith('.p12')) {
                            const blob = await file.async('blob');
                            p12File = new File([blob], filename, { type: 'application/x-pkcs12' });
                        } else if (filename.toLowerCase().endsWith('.mobileprovision')) {
                            const blob = await file.async('blob');
                            mobileprovisionFile = new File([blob], filename, { type: 'application/x-apple-aspen-config' });
                        }
                    }
                }
                
                if (!p12File) {
                    alert('Không tìm thấy file .p12 trong file zip!');
                    this.certZipCss = 'invalid';
                    this.isExtractingZip = false;
                    return;
                }
                
                if (!mobileprovisionFile) {
                    alert('Không tìm thấy file .mobileprovision trong file zip!');
                    this.certZipCss = 'invalid';
                    this.isExtractingZip = false;
                    return;
                }
                
                // Store the extracted files
                this.p12 = p12File;
                this.mobileprovision = mobileprovisionFile;
                
                this.certZipCss = 'valid';
                this.certZipText = `${p12File.name} và ${mobileprovisionFile.name}`;
                
            } catch (error) {
                console.error('Error extracting zip file:', error);
                alert('Có lỗi xảy ra khi giải nén file zip!');
                this.certZipCss = 'invalid';
                this.certZipText = 'Lỗi giải nén - chọn file khác...';
            }
            
            this.isExtractingZip = false;
        },
        
        async upload() {
            console.log('=== UPLOAD START ===');
            
            // DEBUG BẮT BUỘC: Kiểm tra biến ipa
            console.log('DEBUG IPA CHECK:', {
                'this.ipa': this.ipa,
                'ipa.name': this.ipa ? this.ipa.name : 'null',
                'ipa.size': this.ipa ? this.formatFileSize(this.ipa.size) : 'null',
                'ipa.type': this.ipa ? this.ipa.type : 'null',
                'selectedApp': this.selectedApp,
                'isCustom': this.selectedApp === 'custom'
            });
            
            // Validate required fields
            if (!this.ipa) {
                alert('❌ Chưa chọn file IPA! Vui lòng chọn ứng dụng hoặc upload IPA.');
                console.log('❌ Upload failed: No IPA file selected');
                return;
            }
            
            if (!this.certZip) {
                alert('❌ Chưa chọn file ZIP chứng chỉ!');
                console.log('❌ Upload failed: No cert ZIP selected');
                return;
            }
            
            if (!this.password) {
                alert('❌ Chưa nhập mật khẩu chứng chỉ!');
                console.log('❌ Upload failed: No password entered');
                return;
            }
            
            // Check if zip extraction was successful
            if (!this.p12 || !this.mobileprovision) {
                alert('❌ File zip không chứa đủ file cần thiết (.p12 và .mobileprovision)!');
                console.log('❌ Upload failed: ZIP extraction failed');
                return;
            }
            
            // Kiểm tra kích thước IPA
            if (this.ipa.size === 0) {
                alert('❌ IPA file bị lỗi (kích thước = 0). Vui lòng thử lại!');
                console.log('❌ Upload failed: IPA file size is 0');
                return;
            }
            
            // Save password to history
            this.savePasswordToHistory(this.password);
            
            this.showStep1 = false;
            this.showStep2 = true;
            this.progressBar = 0;
            this.uploadStep = 1;
            this.uploadDetails = 'Đang chuẩn bị upload...';
            
            // Simulate upload steps based on progress percentage
            const progressInterval = setInterval(() => {
                // Update upload step based on progress percentage
                if (this.progressBar < 20) {
                    this.uploadStep = 1; // Tải IPA
                    this.uploadDetails = 'Đang tải file IPA lên server...';
                } else if (this.progressBar < 36) {
                    this.uploadStep = 2; // Nhận IPA
                    this.uploadDetails = 'Server đang nhận file IPA...';
                } else if (this.progressBar < 70) {
                    this.uploadStep = 3; // Bắt đầu ký
                    this.uploadDetails = 'Bắt đầu quá trình ký IPA...';
                } else if (this.progressBar < 99) {
                    this.uploadStep = 4; // Hoàn tất
                    this.uploadDetails = 'Hoàn tất upload, đang xử lý...';
                }
                
                if (this.progressBar >= 100) {
                    clearInterval(progressInterval);
                }
            }, 100);
            
            // Tạo FormData - SỬ DỤNG BIẾN IPA DUY NHẤT
            const fd = new FormData();
            fd.append('ipa', this.ipa, this.ipa.name);
            fd.append('p12', this.p12, this.p12.name);
            fd.append('mp', this.mobileprovision, this.mobileprovision.name);
            fd.append('password', this.password);
            
            // Thêm các trường optional từ code cũ (để tương thích backend)
            fd.append('app_name', this.selectedAppName || '');
            fd.append('bundle_id', '');
            
            // Debug chi tiết
            console.log('=== UPLOAD DEBUG DETAILS ===');
            console.log('Upload URL:', SignUrl);
            console.log('IPA Details:', {
                name: this.ipa.name,
                size: this.ipa.size,
                type: this.ipa.type,
                source: this.selectedApp === 'custom' ? 'Custom Upload' : 'Auto Load'
            });
            console.log('P12 File:', {
                name: this.p12.name,
                size: this.p12.size,
                type: this.p12.type
            });
            console.log('Mobileprovision:', {
                name: this.mobileprovision.name,
                size: this.mobileprovision.size,
                type: this.mobileprovision.type
            });
            
            // Log tất cả FormData entries
            console.log('FormData entries:');
            for (let pair of fd.entries()) {
                console.log(pair[0], ':', pair[1].name || pair[1]);
            }
            
            try {
                // Sử dụng XMLHttpRequest để upload
                const xhr = new XMLHttpRequest();
                
                // Setup progress tracking
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        this.progressBar = Math.round((e.loaded / e.total) * 100);
                    }
                });
                
                // Handle response
                xhr.onload = () => {
                    clearInterval(progressInterval);
                    
                    console.log('Server response status:', xhr.status);
                    console.log('Server response text:', xhr.responseText);
                    
                    // Status 202 thường là "Accepted" - request được chấp nhận nhưng chưa xử lý xong
                    if (xhr.status === 202 || xhr.status === 200) {
                        try {
                            let responseData;
                            
                            // Thử parse JSON
                            if (xhr.responseText.trim() === '') {
                                // Nếu response trống
                                responseData = { 
                                    task_id: 'temp_' + Date.now(),
                                    message: 'Request accepted by server'
                                };
                            } else {
                                responseData = JSON.parse(xhr.responseText);
                            }
                            
                            // Xử lý response
                            if (responseData.task_id) {
                                this.jobId = responseData.task_id;
                                this.showStep2 = false;
                                this.showStep3 = true;
                                this.statusText = 'Đã nhận job, đang xử lý...';
                                this.pollStatus();
                            } else if (responseData.message) {
                                // Nếu server chỉ trả về message
                                this.jobId = 'job_' + Date.now();
                                this.showStep2 = false;
                                this.showStep3 = true;
                                this.statusText = responseData.message;
                                this.pollStatus();
                            } else {
                                // Trường hợp khác
                                this.jobId = 'job_' + Date.now();
                                this.showStep2 = false;
                                this.showStep3 = true;
                                this.statusText = 'Đang xử lý...';
                                this.pollStatus();
                            }
                        } catch (parseError) {
                            console.error('Parse error:', parseError);
                            
                            // Nếu không parse được JSON, xử lý như text response
                            if (xhr.responseText.trim().length > 0) {
                                // Có thể response là plain text task_id
                                const taskIdMatch = xhr.responseText.trim().match(/[a-zA-Z0-9_-]+/);
                                if (taskIdMatch) {
                                    this.jobId = taskIdMatch[0];
                                    this.showStep2 = false;
                                    this.showStep3 = true;
                                    this.statusText = 'Đang xử lý...';
                                    this.pollStatus();
                                } else {
                                    // Hiển thị response text
                                    alert('Server response: ' + xhr.responseText.substring(0, 200));
                                    this.showStep1 = true;
                                    this.showStep2 = false;
                                }
                            } else {
                                // Response trống
                                this.jobId = 'job_' + Date.now();
                                this.showStep2 = false;
                                this.showStep3 = true;
                                this.statusText = 'Đang xử lý...';
                                this.pollStatus();
                            }
                        }
                    } else {
                        // Lỗi server
                        let errorMsg = `Server error: ${xhr.status}`;
                        if (xhr.responseText) {
                            try {
                                const errorData = JSON.parse(xhr.responseText);
                                errorMsg = errorData.error || errorData.message || errorMsg;
                            } catch {
                                errorMsg = xhr.responseText.substring(0, 200);
                            }
                        }
                        
                        alert(errorMsg);
                        this.showStep1 = true;
                        this.showStep2 = false;
                    }
                };
                
                // Handle errors
                xhr.onerror = () => {
                    clearInterval(progressInterval);
                    alert('Lỗi kết nối đến server. Vui lòng kiểm tra mạng và thử lại.');
                    this.showStep1 = true;
                    this.showStep2 = false;
                };
                
                xhr.onabort = () => {
                    clearInterval(progressInterval);
                    alert('Upload bị hủy.');
                    this.showStep1 = true;
                    this.showStep2 = false;
                };
                
                // Send request
                xhr.open('POST', SignUrl);
                xhr.send(fd);
                
            } catch (err) {
                clearInterval(progressInterval);
                console.error('Upload error:', err);
                alert('Có lỗi xảy ra khi upload: ' + err.message);
                this.showStep1 = true;
                this.showStep2 = false;
            }
        },
        
        async pollStatus() {
            this.statusText = 'Đang chờ xử lý...';
            this.logText = '';
            
            const timer = setInterval(async () => {
                try {
                    // Kiểm tra xem StatusUrl có được định nghĩa không
                    if (typeof StatusUrl === 'undefined') {
                        console.error('StatusUrl is not defined');
                        this.statusText = 'Lỗi: StatusUrl không xác định';
                        return;
                    }
                    
                    const statusUrl = `${StatusUrl}/${this.jobId}`;
                    console.log('Polling status from:', statusUrl);
                    
                    const response = await fetch(statusUrl);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const responseText = await response.text();
                    console.log('Status response:', responseText);
                    
                    let d;
                    try {
                        d = JSON.parse(responseText);
                    } catch (parseError) {
                        console.error('Parse status error:', parseError);
                        // Nếu không parse được JSON, tạo object từ text
                        d = {
                            status: 'PROCESSING',
                            msg: responseText || 'Đang xử lý...'
                        };
                    }
                    
                    this.statusText = d.status || 'Đang xử lý...';
                    this.logText = d.msg || '';
                    
                    if (d.status === 'SUCCESS' || d.status === 'COMPLETED') {
                        const base = `${DownloadUrl}/${this.jobId}`;
                        this.download = base;
                        this.download_ipa = base;
                        clearInterval(timer);
                        
                        // Save to Firestore and get share URL
                        const docId = await this.saveToFirestore(base);
                        if (docId) {
                            this.showStep3 = false;
                            this.showStep4 = true;
                            
                            // Generate QR Code
                            setTimeout(() => {
                                // Xóa QR code cũ nếu có
                                const qrContainer = document.getElementById('qrcode');
                                if (qrContainer) {
                                    qrContainer.innerHTML = '';
                                }
                                
                                new QRCode(document.getElementById('qrcode'), {
                                    width: 130,
                                    height: 130,
                                    colorDark: "#000000",
                                    colorLight: "#ffffff",
                                    correctLevel: QRCode.CorrectLevel.H
                                }).makeCode(this.download);
                            }, 100);
                        } else {
                            alert('Có lỗi khi tạo link chia sẻ!');
                            this.index();
                        }
                        
                    } else if (d.status === 'FAILURE' || d.status === 'ERROR') {
                        clearInterval(timer);
                        alert('Ký IPA thất bại: ' + (d.msg || ''));
                        this.index();
                    }
                } catch (err) {
                    console.error('Poll status error:', err);
                    
                    // Nếu lỗi, tiếp tục poll hoặc dừng sau một số lần thử
                    if (err.message.includes('404')) {
                        // Job not found, có thể đã hoàn thành hoặc bị xóa
                        this.statusText = 'Đang chờ kết quả...';
                    } else {
                        this.statusText = 'Lỗi kết nối: ' + err.message;
                    }
                }
            }, 3000);
            
            // Stop polling after 10 minutes
            setTimeout(() => {
                clearInterval(timer);
                if (this.showStep3) {
                    alert('Quá trình xử lý mất quá nhiều thời gian. Vui lòng thử lại.');
                    this.index();
                }
            }, 10 * 60 * 1000);
        },
        
        copyShareUrl() {
            const input = this.$refs.shareUrlInput;
            input.select();
            input.setSelectionRange(0, 99999); // For mobile devices
            
            try {
                navigator.clipboard.writeText(this.shareUrl).then(() => {
                    this.copySuccess = true;
                    setTimeout(() => {
                        this.copySuccess = false;
                    }, 3000);
                });
            } catch (err) {
                // Fallback for older browsers
                document.execCommand('copy');
                this.copySuccess = true;
                setTimeout(() => {
                    this.copySuccess = false;
                }, 3000);
            }
        },
        
        index() { 
            window.location.href = window.location.pathname;
        },
        
        goToHome() {
            window.location.href = window.location.pathname;
        }
    },
    watch: {
        password(val) { 
            this.pwdCss = val.length ? 'valid' : 'invalid'; 
            // Force update canSign khi password thay đổi
            this.$nextTick(() => {
                this.$forceUpdate();
            });
        },
        
        certZip(val) {
            if (!val) {
                this.p12 = null;
                this.mobileprovision = null;
            }
            // Force update canSign khi certZip thay đổi
            this.$nextTick(() => {
                this.$forceUpdate();
            });
        },
        
        // Thêm watcher cho biến ipa duy nhất
        ipa(newVal) {
            console.log('IPA variable changed:', newVal ? `Có file (${newVal.name})` : 'Không có file');
            this.$nextTick(() => {
                this.$forceUpdate();
            });
        },
        
        customIpaFile(newVal) {
            console.log('Custom IPA file changed:', newVal ? `Có file (${newVal.name})` : 'Không có file');
            this.$nextTick(() => {
                this.$forceUpdate();
            });
        },
        
        selectedApp(newVal, oldVal) {
            // Nếu đổi từ custom sang auto app, reset customIpaFile
            if (oldVal === 'custom' && newVal !== 'custom') {
                this.customIpaFile = null;
                if (this.$refs.customIpaInput) {
                    this.$refs.customIpaInput.value = '';
                }
            }
            this.$nextTick(() => {
                this.$forceUpdate();
            });
        }
    }
});