# WorksAuto Backend — Tam Mimari ve Algoritma Şeması

Bu dokümanı editör içinde `Cmd + Shift + V` (Mac) veya `Ctrl + Shift + V` (Windows) tuşlarına basarak görsel şema olarak inceleyebilirsiniz.

---

## 1. 10 Adımlı Uçtan Uca İstek Hattı (Request Pipeline)

```mermaid
flowchart LR
    C["1. Client<br/>(Next.js 16)"] --> E["2. Edge Proxy<br/>(worksauto_session)"]
    E --> H["3. CORS & HSTS<br/>(Security Headers)"]
    H --> G["4. JwtAuthGuard<br/>(tenantId extraction)"]
    G --> R["5. Redis Lock<br/>(Idempotency Key)"]
    R --> V["6. ValidationPipe<br/>(class-validator DTO)"]
    V --> Ctrl["7. Controller<br/>(Presentation Layer)"]
    Ctrl --> UC["8. UseCase<br/>(Application Layer)"]
    UC --> DB[("9. Prisma & Postgres<br/>(WHERE tenantId = ...)")]
    UC --> WS["10. Socket.IO<br/>(Chime / EventBus)"]

    style C fill:#082f49,stroke:#38bdf8,stroke-width:2px,color:#fff
    style E fill:#082f49,stroke:#38bdf8,stroke-width:2px,color:#fff
    style H fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff
    style G fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff
    style R fill:#451a03,stroke:#fbbf24,stroke-width:2px,color:#fff
    style V fill:#451a03,stroke:#fbbf24,stroke-width:2px,color:#fff
    style Ctrl fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff
    style UC fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff
    style DB fill:#4c0519,stroke:#f43f5e,stroke-width:2px,color:#fff
    style WS fill:#4c0519,stroke:#f43f5e,stroke-width:2px,color:#fff
```

---

## 2. 8 Temel Modül, 24 Alt Kategori & 144 Operasyon Matrisi

```mermaid
graph TB
    subgraph M1["1. Customers (Müşteri & Cari Yönetimi)"]
        direction TB
        c_1_1["<b>Müşteri CRUD</b><br/>get_customer_list<br/>get_customer_info<br/>add_customer<br/>update_customer<br/>del_customer<br/>anonymize_customer"]
        c_1_2["<b>Toplu & Hızlı Kayıt</b><br/>add_quick_lead<br/>batch_import_excel<br/>find_by_phone<br/>validate_tax_number<br/>export_customers<br/>export_customer_statement"]
        c_1_3["<b>Cari & İstatistik</b><br/>get_customer_stats<br/>get_current_account<br/>add_cari_movement<br/>get_cari_movements<br/>calc_customer_debt<br/>check_credit_limit"]
    end

    subgraph M2["2. Vehicles / Cars (Araç Yönetimi)"]
        direction TB
        c_2_1["<b>Araç CRUD</b><br/>get_car_list<br/>get_car_info<br/>add_car<br/>update_car<br/>del_car<br/>get_customer_cars"]
        c_2_2["<b>Plaka & Doğrulama</b><br/>find_by_plate<br/>validate_plate_format<br/>update_odometer_km<br/>validate_vin_format<br/>check_fuel_type<br/>export_vehicles"]
        c_2_3["<b>Servis Geçmişi</b><br/>get_service_history<br/>get_car_work_orders<br/>get_car_appointments<br/>link_to_work_order<br/>get_last_service_date<br/>get_odometer_history"]
    end

    subgraph M3["3. Work Orders (Atölye İş Emirleri & Lift)"]
        direction TB
        c_3_1["<b>İş Emri Yaşam Döngüsü</b><br/>get_work_order_list<br/>get_work_order_detail<br/>create_work_order<br/>update_order_status<br/>complete_work_order<br/>rollback_work_order"]
        c_3_2["<b>Parça & Stok Senkronu</b><br/>add_work_order_item<br/>remove_work_order_item<br/>reserve_stock_parts<br/>deduct_stock_on_complete<br/>return_stock_on_cancel<br/>calculate_order_totals"]
        c_3_3["<b>Ekspertiz & Usta</b><br/>add_checkin_photo<br/>add_damage_photo<br/>add_completed_photo<br/>add_mechanic_note<br/>assign_lift_and_tech<br/>generate_wo_invoice"]
    end

    subgraph M4["4. Appointments (Randevu & Kapasite)"]
        direction TB
        c_4_1["<b>Randevu Takvimi</b><br/>get_appointment_list<br/>get_appointment_detail<br/>create_appointment<br/>approve_appointment<br/>reschedule_appointment<br/>cancel_appointment"]
        c_4_2["<b>Online Web Randevu</b><br/>create_public_booking<br/>get_tenant_public_info<br/>get_public_services<br/>validate_booking_slot<br/>send_sms_confirmation<br/>mark_as_no_show"]
        c_4_3["<b>Çakışma & Kapasite</b><br/>check_slot_available<br/>auto_exclude_conflict<br/>get_lift_calendar<br/>get_tech_calendar<br/>calculate_service_time<br/>convert_to_work_order"]
    end

    subgraph M5["5. Inventory (Yedek Parça & Depo)"]
        direction TB
        c_5_1["<b>Parça Kataloğu</b><br/>get_product_list<br/>get_product_detail<br/>create_product<br/>update_product<br/>find_by_oem_code<br/>find_by_barcode"]
        c_5_2["<b>Stok Hareketleri</b><br/>add_stock_in_purchase<br/>add_stock_out_service<br/>add_stock_adjustment<br/>add_stock_return<br/>get_stock_movements<br/>rollback_movement"]
        c_5_3["<b>Depo & Kritik Seviye</b><br/>check_critical_stocks<br/>update_shelf_location<br/>get_category_summary<br/>calc_stock_valuation<br/>export_inventory_excel<br/>batch_import_products"]
    end

    subgraph M6["6. Billing & Invoices (Fatura & Kasa)"]
        direction TB
        c_6_1["<b>Fatura İşlemleri</b><br/>get_invoice_list<br/>get_invoice_detail<br/>create_invoice_from_wo<br/>create_manual_invoice<br/>cancel_invoice<br/>generate_pdf_invoice"]
        c_6_2["<b>Tahsilat & POS</b><br/>record_payment<br/>process_partial_payment<br/>reconcile_daily_closing<br/>reconcile_bank_statement<br/>refund_payment<br/>get_payment_receipt"]
        c_6_3["<b>Finans & Alacaklar</b><br/>get_tenant_receivables<br/>get_daily_cash_report<br/>sync_current_accounts<br/>calc_kdv_tax_totals<br/>export_invoices_excel<br/>get_debtor_customers"]
    end

    subgraph M7["7. Auth & Multi-Tenancy (Güvenlik)"]
        direction TB
        c_7_1["<b>Oturum & Kimlik</b><br/>login_with_password<br/>send_otp_sms<br/>verify_otp_code<br/>refresh_access_token<br/>logout_session<br/>change_password"]
        c_7_2["<b>Kiracı İzolasyonu</b><br/>get_tenant_profile<br/>update_tenant_profile<br/>set_working_hours<br/>resolve_tenant_by_slug<br/>extract_tenant_from_jwt<br/>enforce_tenant_isolation"]
        c_7_3["<b>Personel & Yetki (RBAC)</b><br/>get_staff_list<br/>create_staff_user<br/>update_staff_role<br/>check_permission_guard<br/>toggle_staff_active<br/>delete_staff_user"]
    end

    subgraph M8["8. Audit & Platform Admin (Yönetim)"]
        direction TB
        c_8_1["<b>Denetim Günlüğü</b><br/>get_tenant_audit_logs<br/>get_audit_log_detail<br/>record_audit_event<br/>format_audit_payload<br/>mask_client_ip<br/>export_audit_logs"]
        c_8_2["<b>Süper Yönetici</b><br/>admin_login<br/>get_all_tenants_list<br/>create_new_tenant<br/>toggle_tenant_license<br/>delete_tenant_data<br/>get_system_health"]
        c_8_3["<b>Platform Metrikleri</b><br/>get_platform_kpis<br/>get_db_latency_metric<br/>get_total_volume_stats<br/>monitor_redis_queues<br/>clear_expired_sessions<br/>inspect_failed_logins"]
    end

    style M1 fill:#082f49,stroke:#38bdf8,stroke-width:2px,color:#fff
    style M2 fill:#134e4a,stroke:#2dd4bf,stroke-width:2px,color:#fff
    style M3 fill:#451a03,stroke:#fbbf24,stroke-width:2px,color:#fff
    style M4 fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff
    style M5 fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff
    style M6 fill:#2e1065,stroke:#a78bfa,stroke-width:2px,color:#fff
    style M7 fill:#500724,stroke:#f472b6,stroke-width:2px,color:#fff
    style M8 fill:#4c0519,stroke:#fb7185,stroke-width:2px,color:#fff
```
