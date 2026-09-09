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

## 2. Optimize Edilmiş 8 Modül Matrisi & Fonksiyon Blokları

```mermaid
graph TB
    subgraph M1["1. Customers (Müşteri & Cari)"]
        direction TB
        c1["get_customer_list<br/>get_customer_info<br/>add_customer<br/>update_customer<br/>del_customer"]
        c2["add_quick_lead<br/>batch_import_excel<br/>find_by_phone<br/>export_customers<br/>export_customer_statement"]
        c3["get_customer_stats<br/>get_current_account<br/>add_cari_movement<br/>calc_customer_debt<br/>check_credit_limit"]
    end

    subgraph M2["2. Vehicles (Araç Yönetimi)"]
        direction TB
        v1["get_car_list<br/>get_car_info<br/>add_car<br/>update_car<br/>del_car"]
        v2["find_by_plate<br/>validate_plate_format<br/>update_odometer_km<br/>validate_vin_format<br/>check_fuel_type"]
        v3["get_service_history<br/>get_car_work_orders<br/>link_to_work_order<br/>get_odometer_history"]
    end

    subgraph M3["3. Work Orders (İş Emirleri & Lift)"]
        direction TB
        w1["get_work_order_list<br/>get_work_order_detail<br/>create_work_order<br/>update_order_status"]
        w2["add_work_order_item<br/>remove_work_order_item<br/>reserve_stock_parts<br/>deduct_stock_on_complete"]
        w3["add_checkin_photo<br/>add_damage_photo<br/>assign_lift_and_tech<br/>generate_wo_invoice"]
    end

    subgraph M4["4. Appointments (Randevu Motoru)"]
        direction TB
        a1["get_appointment_list<br/>create_appointment<br/>approve_appointment<br/>cancel_appointment"]
        a2["create_public_booking<br/>get_tenant_public_info<br/>validate_booking_slot<br/>send_sms_confirmation"]
        a3["check_slot_available<br/>auto_exclude_conflict<br/>get_lift_calendar<br/>convert_to_work_order"]
    end

    subgraph M5["5. Inventory (Yedek Parça & Depo)"]
        direction TB
        i1["get_product_list<br/>create_product<br/>update_product<br/>find_by_oem_code"]
        i2["add_stock_in_purchase<br/>add_stock_out_service<br/>get_stock_movements<br/>rollback_movement"]
        i3["check_critical_stocks<br/>update_shelf_location<br/>calc_stock_valuation<br/>batch_import_products"]
    end

    subgraph M6["6. Billing & Invoices (Fatura & Kasa)"]
        direction TB
        b1["get_invoice_list<br/>create_invoice_from_wo<br/>cancel_invoice<br/>generate_pdf_invoice"]
        b2["record_payment<br/>process_partial_payment<br/>reconcile_daily_closing<br/>refund_payment"]
        b3["get_tenant_receivables<br/>get_daily_cash_report<br/>sync_current_accounts<br/>calc_kdv_tax_totals"]
    end

    subgraph M7["7. Auth & Multi-Tenancy (Güvenlik)"]
        direction TB
        au1["login_with_password<br/>send_otp_sms<br/>verify_otp_code<br/>refresh_access_token<br/>logout_session"]
        au2["get_tenant_profile<br/>update_tenant_profile<br/>set_working_hours<br/>enforce_tenant_isolation"]
        au3["get_staff_list<br/>create_staff_user<br/>update_staff_role<br/>toggle_staff_active"]
    end

    subgraph M8["8. Audit & Platform Admin (Yönetim)"]
        direction TB
        ad1["get_tenant_audit_logs<br/>get_audit_log_detail<br/>record_audit_event<br/>mask_client_ip"]
        ad2["admin_login<br/>get_all_tenants_list<br/>create_new_tenant<br/>toggle_tenant_license"]
        ad3["get_system_health<br/>get_platform_kpis<br/>monitor_redis_queues<br/>inspect_failed_logins"]
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
