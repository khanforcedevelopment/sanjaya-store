
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "addresses": {
                  Row: {
                    "city": string,"created_at": string,"house": string,"id": string,"is_default": boolean,"label": string,"landmark": string | null,"latitude": number | null,"location_source": string,"longitude": number | null,"phone": string,"pincode": string,"recipient_name": string,"state": string,"street": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city": string,"created_at"?: string,"house": string,"id"?: string,"is_default"?: boolean,"label"?: string,"landmark"?: string | null,"latitude"?: number | null,"location_source"?: string,"longitude"?: number | null,"phone": string,"pincode": string,"recipient_name": string,"state": string,"street": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "city"?: string,"created_at"?: string,"house"?: string,"id"?: string,"is_default"?: boolean,"label"?: string,"landmark"?: string | null,"latitude"?: number | null,"location_source"?: string,"longitude"?: number | null,"phone"?: string,"pincode"?: string,"recipient_name"?: string,"state"?: string,"street"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "addresses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"entity": string,"entity_id": string | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity": string,"entity_id"?: string | null,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string | null,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"banners": {
                  Row: {
                    "created_at": string,"cta_href": string | null,"cta_label": string | null,"ends_at": string | null,"eyebrow": string | null,"id": string,"image_url": string | null,"is_active": boolean,"placement": string,"sort_order": number,"starts_at": string | null,"subtitle": string | null,"theme": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"cta_href"?: string | null,"cta_label"?: string | null,"ends_at"?: string | null,"eyebrow"?: string | null,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"placement"?: string,"sort_order"?: number,"starts_at"?: string | null,"subtitle"?: string | null,"theme"?: string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"cta_href"?: string | null,"cta_label"?: string | null,"ends_at"?: string | null,"eyebrow"?: string | null,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"placement"?: string,"sort_order"?: number,"starts_at"?: string | null,"subtitle"?: string | null,"theme"?: string,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"image_url": string | null,"installment_eligible": boolean,"is_active": boolean,"name": string,"parent_id": string | null,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"image_url"?: string | null,"installment_eligible"?: boolean,"is_active"?: boolean,"name": string,"parent_id"?: string | null,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"image_url"?: string | null,"installment_eligible"?: boolean,"is_active"?: boolean,"name"?: string,"parent_id"?: string | null,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"collection_notes": {
                  Row: {
                    "author_id": string,"created_at": string,"id": number,"note": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"created_at"?: string,"id"?: never,"note": string,"task_id": string
                  }
                  Update: {
                    "author_id"?: string,"created_at"?: string,"id"?: never,"note"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "collection_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_notes_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "collection_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"collection_tasks": {
                  Row: {
                    "assigned_to": string | null,"created_at": string,"id": string,"installment_id": string,"promised_date": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"created_at"?: string,"id"?: string,"installment_id": string,"promised_date"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"created_at"?: string,"id"?: string,"installment_id"?: string,"promised_date"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "collection_tasks_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_tasks_installment_id_fkey"
      columns: ["installment_id"]
isOneToOne: false
      referencedRelation: "installments"
      referencedColumns: ["id"]
    }
                  ]
                },"coupon_redemptions": {
                  Row: {
                    "coupon_id": string,"created_at": string,"discount_paise": number,"id": string,"is_released": boolean,"order_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coupon_id": string,"created_at"?: string,"discount_paise": number,"id"?: string,"is_released"?: boolean,"order_id": string,"user_id": string
                  }
                  Update: {
                    "coupon_id"?: string,"created_at"?: string,"discount_paise"?: number,"id"?: string,"is_released"?: boolean,"order_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupon_redemptions_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_redemptions_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_redemptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"coupons": {
                  Row: {
                    "assigned_user_id": string | null,"code": string,"created_at": string,"created_by": string | null,"description": string | null,"discount_type": string,"discount_value": number,"ends_at": string | null,"first_order_only": boolean,"id": string,"is_active": boolean,"max_discount_paise": number | null,"min_subtotal_paise": number,"per_user_limit": number,"starts_at": string | null,"usage_limit": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_user_id"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"discount_type": string,"discount_value": number,"ends_at"?: string | null,"first_order_only"?: boolean,"id"?: string,"is_active"?: boolean,"max_discount_paise"?: number | null,"min_subtotal_paise"?: number,"per_user_limit"?: number,"starts_at"?: string | null,"usage_limit"?: number | null
                  }
                  Update: {
                    "assigned_user_id"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"discount_type"?: string,"discount_value"?: number,"ends_at"?: string | null,"first_order_only"?: boolean,"id"?: string,"is_active"?: boolean,"max_discount_paise"?: number | null,"min_subtotal_paise"?: number,"per_user_limit"?: number,"starts_at"?: string | null,"usage_limit"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupons_assigned_user_id_fkey"
      columns: ["assigned_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupons_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_assignments": {
                  Row: {
                    "assigned_by": string | null,"created_at": string,"id": string,"is_active": boolean,"order_id": string,"scheduled_date": string | null,"staff_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_by"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"order_id": string,"scheduled_date"?: string | null,"staff_id": string
                  }
                  Update: {
                    "assigned_by"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"order_id"?: string,"scheduled_date"?: string | null,"staff_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_assignments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_assignments_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_attempts": {
                  Row: {
                    "created_at": string,"id": string,"latitude": number | null,"longitude": number | null,"note": string | null,"order_id": string,"outcome": string,"rescheduled_for": string | null,"staff_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"note"?: string | null,"order_id": string,"outcome": string,"rescheduled_for"?: string | null,"staff_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"note"?: string | null,"order_id"?: string,"outcome"?: string,"rescheduled_for"?: string | null,"staff_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_attempts_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_attempts_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_zones": {
                  Row: {
                    "code": string,"fee_override_paise": number | null,"id": string,"is_active": boolean,"is_remote": boolean,"max_days": number,"min_days": number,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"fee_override_paise"?: number | null,"id"?: string,"is_active"?: boolean,"is_remote"?: boolean,"max_days": number,"min_days": number,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"fee_override_paise"?: number | null,"id"?: string,"is_active"?: boolean,"is_remote"?: boolean,"max_days"?: number,"min_days"?: number,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"installment_plans": {
                  Row: {
                    "agreement_accepted_at": string,"agreement_ip": string | null,"agreement_version": string,"created_at": string,"id": string,"installment_count": number,"order_id": string,"status": string,"total_paise": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agreement_accepted_at": string,"agreement_ip"?: string | null,"agreement_version": string,"created_at"?: string,"id"?: string,"installment_count"?: number,"order_id": string,"status"?: string,"total_paise": number,"user_id": string
                  }
                  Update: {
                    "agreement_accepted_at"?: string,"agreement_ip"?: string | null,"agreement_version"?: string,"created_at"?: string,"id"?: string,"installment_count"?: number,"order_id"?: string,"status"?: string,"total_paise"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "installment_plans_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "installment_plans_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"installments": {
                  Row: {
                    "amount_paise": number,"due_date": string,"id": string,"last_reminder_at": string | null,"paid_at": string | null,"plan_id": string,"reminder_count": number,"seq": number,"status": Database["public"]['Enums']["installment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"due_date": string,"id"?: string,"last_reminder_at"?: string | null,"paid_at"?: string | null,"plan_id": string,"reminder_count"?: number,"seq": number,"status"?: Database["public"]['Enums']["installment_status"]
                  }
                  Update: {
                    "amount_paise"?: number,"due_date"?: string,"id"?: string,"last_reminder_at"?: string | null,"paid_at"?: string | null,"plan_id"?: string,"reminder_count"?: number,"seq"?: number,"status"?: Database["public"]['Enums']["installment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "installments_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "installment_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"delta": number,"id": number,"note": string | null,"order_id": string | null,"reason": string,"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"delta": number,"id"?: never,"note"?: string | null,"order_id"?: string | null,"reason": string,"variant_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"delta"?: number,"id"?: never,"note"?: string | null,"order_id"?: string | null,"reason"?: string,"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"kyc_applications": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"decision_reasons": (string)[],"document_number_hash": string | null,"document_type": string | null,"face_match_score": number | null,"id": string,"liveness_passed": boolean | null,"name_on_document": string | null,"provider": string,"provider_reference": string | null,"risk_flags": (string)[],"status": Database["public"]['Enums']["kyc_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_reasons"?: (string)[],"document_number_hash"?: string | null,"document_type"?: string | null,"face_match_score"?: number | null,"id"?: string,"liveness_passed"?: boolean | null,"name_on_document"?: string | null,"provider": string,"provider_reference"?: string | null,"risk_flags"?: (string)[],"status"?: Database["public"]['Enums']["kyc_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_reasons"?: (string)[],"document_number_hash"?: string | null,"document_type"?: string | null,"face_match_score"?: number | null,"id"?: string,"liveness_passed"?: boolean | null,"name_on_document"?: string | null,"provider"?: string,"provider_reference"?: string | null,"risk_flags"?: (string)[],"status"?: Database["public"]['Enums']["kyc_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kyc_applications_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kyc_applications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"loyalty_ledger": {
                  Row: {
                    "created_at": string,"id": number,"note": string | null,"order_id": string | null,"points": number,"reason": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"note"?: string | null,"order_id"?: string | null,"points": number,"reason": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"note"?: string | null,"order_id"?: string | null,"points"?: number,"reason"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loyalty_ledger_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "loyalty_ledger_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "attempts": number,"channel": string,"created_at": string,"id": number,"last_error": string | null,"payload": NonNullable<Json>,"sent_at": string | null,"status": string,"template": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"channel": string,"created_at"?: string,"id"?: never,"last_error"?: string | null,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: string,"template": string,"user_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"channel"?: string,"created_at"?: string,"id"?: never,"last_error"?: string | null,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: string,"template"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_delivery_codes": {
                  Row: {
                    "code": string,"order_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"order_id": string
                  }
                  Update: {
                    "code"?: string,"order_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_delivery_codes_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"image_url": string | null,"line_total_paise": number,"order_id": string,"product_id": string,"product_name": string,"quantity": number,"sku": string,"unit_price_paise": number,"variant_id": string,"variant_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"image_url"?: string | null,"line_total_paise": number,"order_id": string,"product_id": string,"product_name": string,"quantity": number,"sku": string,"unit_price_paise": number,"variant_id": string,"variant_name": string
                  }
                  Update: {
                    "id"?: string,"image_url"?: string | null,"line_total_paise"?: number,"order_id"?: string,"product_id"?: string,"product_name"?: string,"quantity"?: number,"sku"?: string,"unit_price_paise"?: number,"variant_id"?: string,"variant_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"order_status_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"id": number,"is_customer_visible": boolean,"note": string | null,"order_id": string,"status": Database["public"]['Enums']["order_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"is_customer_visible"?: boolean,"note"?: string | null,"order_id": string,"status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"is_customer_visible"?: boolean,"note"?: string | null,"order_id"?: string,"status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_status_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_status_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_status_transitions": {
                  Row: {
                    "allowed_roles": (string)[],"from_status": Database["public"]['Enums']["order_status"],"to_status": Database["public"]['Enums']["order_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_roles": (string)[],"from_status": Database["public"]['Enums']["order_status"],"to_status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "allowed_roles"?: (string)[],"from_status"?: Database["public"]['Enums']["order_status"],"to_status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    
                  ]
                },"orders": {
                  Row: {
                    "amount_paid_paise": number,"amount_refunded_paise": number,"approved_at": string | null,"approved_by": string | null,"cancelled_reason": string | null,"coupon_code": string | null,"coupon_id": string | null,"created_at": string,"customer_note": string | null,"delivered_at": string | null,"delivery_fee_paise": number,"discount_paise": number,"estimated_max_date": string | null,"estimated_min_date": string | null,"free_delivery_applied": boolean,"id": string,"is_delayed": boolean,"latitude": number | null,"longitude": number | null,"order_number": string,"payment_expires_at": string | null,"payment_mode": Database["public"]['Enums']["payment_mode"],"pincode": string,"shipping_address": NonNullable<Json>,"status": Database["public"]['Enums']["order_status"],"subtotal_paise": number,"total_paise": number,"updated_at": string,"user_id": string,"zone_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paid_paise"?: number,"amount_refunded_paise"?: number,"approved_at"?: string | null,"approved_by"?: string | null,"cancelled_reason"?: string | null,"coupon_code"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"customer_note"?: string | null,"delivered_at"?: string | null,"delivery_fee_paise"?: number,"discount_paise"?: number,"estimated_max_date"?: string | null,"estimated_min_date"?: string | null,"free_delivery_applied"?: boolean,"id"?: string,"is_delayed"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"order_number"?: string,"payment_expires_at"?: string | null,"payment_mode"?: Database["public"]['Enums']["payment_mode"],"pincode": string,"shipping_address": NonNullable<Json>,"status"?: Database["public"]['Enums']["order_status"],"subtotal_paise": number,"total_paise": number,"updated_at"?: string,"user_id": string,"zone_id"?: string | null
                  }
                  Update: {
                    "amount_paid_paise"?: number,"amount_refunded_paise"?: number,"approved_at"?: string | null,"approved_by"?: string | null,"cancelled_reason"?: string | null,"coupon_code"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"customer_note"?: string | null,"delivered_at"?: string | null,"delivery_fee_paise"?: number,"discount_paise"?: number,"estimated_max_date"?: string | null,"estimated_min_date"?: string | null,"free_delivery_applied"?: boolean,"id"?: string,"is_delayed"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"order_number"?: string,"payment_expires_at"?: string | null,"payment_mode"?: Database["public"]['Enums']["payment_mode"],"pincode"?: string,"shipping_address"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["order_status"],"subtotal_paise"?: number,"total_paise"?: number,"updated_at"?: string,"user_id"?: string,"zone_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "delivery_zones"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_paise": number,"amount_refunded_paise": number,"created_at": string,"currency": string,"failure_reason": string | null,"id": string,"installment_id": string | null,"livemode": boolean,"order_id": string,"paid_at": string | null,"provider": string,"purpose": string,"status": Database["public"]['Enums']["payment_status"],"stripe_checkout_session_id": string | null,"stripe_payment_intent_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"amount_refunded_paise"?: number,"created_at"?: string,"currency"?: string,"failure_reason"?: string | null,"id"?: string,"installment_id"?: string | null,"livemode"?: boolean,"order_id": string,"paid_at"?: string | null,"provider"?: string,"purpose": string,"status"?: Database["public"]['Enums']["payment_status"],"stripe_checkout_session_id"?: string | null,"stripe_payment_intent_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount_paise"?: number,"amount_refunded_paise"?: number,"created_at"?: string,"currency"?: string,"failure_reason"?: string | null,"id"?: string,"installment_id"?: string | null,"livemode"?: boolean,"order_id"?: string,"paid_at"?: string | null,"provider"?: string,"purpose"?: string,"status"?: Database["public"]['Enums']["payment_status"],"stripe_checkout_session_id"?: string | null,"stripe_payment_intent_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_installment_fk"
      columns: ["installment_id"]
isOneToOne: false
      referencedRelation: "installments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pincode_prefixes": {
                  Row: {
                    "is_serviceable": boolean,"prefix": string,"state": string | null,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "is_serviceable"?: boolean,"prefix": string,"state"?: string | null,"zone_id": string
                  }
                  Update: {
                    "is_serviceable"?: boolean,"prefix"?: string,"state"?: string | null,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pincode_prefixes_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "delivery_zones"
      referencedColumns: ["id"]
    }
                  ]
                },"pincodes": {
                  Row: {
                    "city": string | null,"is_serviceable": boolean,"pincode": string,"state": string | null,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"is_serviceable"?: boolean,"pincode": string,"state"?: string | null,"zone_id": string
                  }
                  Update: {
                    "city"?: string | null,"is_serviceable"?: boolean,"pincode"?: string,"state"?: string | null,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pincodes_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "delivery_zones"
      referencedColumns: ["id"]
    }
                  ]
                },"product_images": {
                  Row: {
                    "alt": string | null,"id": string,"product_id": string,"sort_order": number,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string | null,"id"?: string,"product_id": string,"sort_order"?: number,"url": string
                  }
                  Update: {
                    "alt"?: string | null,"id"?: string,"product_id"?: string,"sort_order"?: number,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_variants": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"low_stock_threshold": number,"mrp_paise": number | null,"name": string,"options": NonNullable<Json>,"price_paise": number,"product_id": string,"sku": string,"sort_order": number,"stock": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"low_stock_threshold"?: number,"mrp_paise"?: number | null,"name"?: string,"options"?: NonNullable<Json>,"price_paise": number,"product_id": string,"sku": string,"sort_order"?: number,"stock"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"low_stock_threshold"?: number,"mrp_paise"?: number | null,"name"?: string,"options"?: NonNullable<Json>,"price_paise"?: number,"product_id"?: string,"sku"?: string,"sort_order"?: number,"stock"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "brand": string | null,"category_id": string,"created_at": string,"description": string | null,"id": string,"installment_eligible": boolean | null,"is_active": boolean,"is_featured": boolean,"name": string,"rating_avg": number,"rating_count": number,"search": unknown,"short_description": string | null,"slug": string,"specs": NonNullable<Json>,"tags": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"category_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"installment_eligible"?: boolean | null,"is_active"?: boolean,"is_featured"?: boolean,"name": string,"rating_avg"?: number,"rating_count"?: number,"search"?: never,"short_description"?: string | null,"slug": string,"specs"?: NonNullable<Json>,"tags"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "brand"?: string | null,"category_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"installment_eligible"?: boolean | null,"is_active"?: boolean,"is_featured"?: boolean,"name"?: string,"rating_avg"?: number,"rating_count"?: number,"search"?: never,"short_description"?: string | null,"slug"?: string,"specs"?: NonNullable<Json>,"tags"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string | null,"id": string,"is_blocked": boolean,"marketing_opt_in": boolean,"phone": string | null,"referral_code": string,"referred_by": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"is_blocked"?: boolean,"marketing_opt_in"?: boolean,"phone"?: string | null,"referral_code"?: string,"referred_by"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"is_blocked"?: boolean,"marketing_opt_in"?: boolean,"phone"?: string | null,"referral_code"?: string,"referred_by"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_referred_by_fkey"
      columns: ["referred_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"proof_of_delivery": {
                  Row: {
                    "created_at": string,"delivery_code_verified": boolean,"latitude": number | null,"longitude": number | null,"order_id": string,"photo_path": string | null,"recipient_name": string,"staff_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"delivery_code_verified"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"order_id": string,"photo_path"?: string | null,"recipient_name": string,"staff_id": string
                  }
                  Update: {
                    "created_at"?: string,"delivery_code_verified"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"order_id"?: string,"photo_path"?: string | null,"recipient_name"?: string,"staff_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proof_of_delivery_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proof_of_delivery_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"referral_campaigns": {
                  Row: {
                    "created_at": string,"ends_at": string | null,"headline": string,"id": string,"is_active": boolean,"name": string,"required_referrals": number,"reward_description": string,"reward_type": string,"reward_value": number,"starts_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_at"?: string | null,"headline": string,"id"?: string,"is_active"?: boolean,"name": string,"required_referrals"?: number,"reward_description": string,"reward_type": string,"reward_value"?: number,"starts_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string | null,"headline"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"required_referrals"?: number,"reward_description"?: string,"reward_type"?: string,"reward_value"?: number,"starts_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"referrals": {
                  Row: {
                    "created_at": string,"id": string,"qualified_at": string | null,"qualifying_order_id": string | null,"referee_id": string,"referrer_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"qualified_at"?: string | null,"qualifying_order_id"?: string | null,"referee_id": string,"referrer_id": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"qualified_at"?: string | null,"qualifying_order_id"?: string | null,"referee_id"?: string,"referrer_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "referrals_qualifying_order_id_fkey"
      columns: ["qualifying_order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "referrals_referee_id_fkey"
      columns: ["referee_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "referrals_referrer_id_fkey"
      columns: ["referrer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount_paise": number,"created_at": string,"id": string,"order_id": string,"payment_id": string,"reason": string | null,"requested_by": string | null,"status": string,"stripe_refund_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"created_at"?: string,"id"?: string,"order_id": string,"payment_id": string,"reason"?: string | null,"requested_by"?: string | null,"status"?: string,"stripe_refund_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount_paise"?: number,"created_at"?: string,"id"?: string,"order_id"?: string,"payment_id"?: string,"reason"?: string | null,"requested_by"?: string | null,"status"?: string,"stripe_refund_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"is_verified_purchase": boolean,"product_id": string,"rating": number,"status": string,"title": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"is_verified_purchase"?: boolean,"product_id": string,"rating": number,"status"?: string,"title"?: string | null,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"is_verified_purchase"?: boolean,"product_id"?: string,"rating"?: number,"status"?: string,"title"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reward_grants": {
                  Row: {
                    "campaign_id": string | null,"coupon_id": string | null,"created_at": string,"fulfilled_order_id": string | null,"id": string,"milestone": number,"points": number | null,"reward_type": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"fulfilled_order_id"?: string | null,"id"?: string,"milestone"?: number,"points"?: number | null,"reward_type": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "campaign_id"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"fulfilled_order_id"?: string | null,"id"?: string,"milestone"?: number,"points"?: number | null,"reward_type"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reward_grants_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "referral_campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reward_grants_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reward_grants_fulfilled_order_id_fkey"
      columns: ["fulfilled_order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reward_grants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"site_settings": {
                  Row: {
                    "is_public": boolean,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "is_public"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "is_public"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_roles": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "error": string | null,"id": string,"livemode": boolean,"payload": NonNullable<Json>,"processed_at": string | null,"received_at": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"id": string,"livemode": boolean,"payload": NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"type": string
                  }
                  Update: {
                    "error"?: string | null,"id"?: string,"livemode"?: boolean,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"support_messages": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": number,"is_staff": boolean,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: never,"is_staff"?: boolean,"ticket_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: never,"is_staff"?: boolean,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_messages_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_messages_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "support_tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"support_tickets": {
                  Row: {
                    "created_at": string,"id": string,"order_id": string | null,"status": string,"subject": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"order_id"?: string | null,"status"?: string,"subject": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"order_id"?: string | null,"status"?: string,"subject"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_tickets_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_tickets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"wishlists": {
                  Row: {
                    "created_at": string,"product_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"product_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"product_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishlists_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wishlists_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_add_status_event":
{ Args: { "p_actor": string,"p_note": string,"p_order": string,"p_status": Database["public"]['Enums']["order_status"],"p_visible": boolean }; Returns: undefined
                           },
"_apply_status":
{ Args: { "p_actor": string,"p_note": string,"p_order": string,"p_to": Database["public"]['Enums']["order_status"],"p_visible": boolean }; Returns: undefined
                           },
"_issue_personal_coupon":
{ Args: { "p_description": string,"p_prefix": string,"p_user": string,"p_value": number }; Returns: string
                           },
"_process_referral_rewards":
{ Args: { "p_referrer": string }; Returns: undefined
                           },
"_release_order_reservations":
{ Args: { "p_actor": string,"p_order": string }; Returns: undefined
                           },
"adjust_stock":
{ Args: { "p_delta": number,"p_note"?: string,"p_reason": string,"p_variant": string }; Returns: number
                           },
"admin_dashboard":
{ Args: { "p_from"?: string,"p_to"?: string }; Returns: Json
                           },
"apply_kyc_result":
{ Args: { "p_application": string,"p_document_number_hash": string,"p_document_type": string,"p_face_match_score": number,"p_liveness_passed": boolean,"p_name_on_document": string,"p_provider_flags"?: (string)[] }; Returns: Json
                           },
"apply_referral_code":
{ Args: { "p_code": string }; Returns: undefined
                           },
"approve_order":
{ Args: { "p_note"?: string,"p_order": string }; Returns: undefined
                           },
"assign_collection_task":
{ Args: { "p_staff": string,"p_task": string }; Returns: undefined
                           },
"assign_delivery":
{ Args: { "p_order": string,"p_scheduled_date"?: string,"p_staff": string }; Returns: undefined
                           },
"can_transition":
{ Args: { "p_order": string,"p_to": Database["public"]['Enums']["order_status"] }; Returns: boolean
                           },
"can_view_order":
{ Args: { "p_order": string }; Returns: boolean
                           },
"cancel_my_order":
{ Args: { "p_order": string,"p_reason"?: string }; Returns: undefined
                           },
"check_pincode":
{ Args: { "p_pincode": string }; Returns: Json
                           },
"complete_delivery":
{ Args: { "p_delivery_code"?: string,"p_latitude"?: number,"p_longitude"?: number,"p_order": string,"p_photo_path"?: string,"p_recipient_name": string }; Returns: undefined
                           },
"compute_quote":
{ Args: { "p_coupon_code": string,"p_exclude_order"?: string,"p_items": Json,"p_pincode": string,"p_user_id": string }; Returns: Json
                           },
"create_payment_record":
{ Args: { "p_amount": number,"p_installment": string,"p_livemode": boolean,"p_order": string,"p_purpose": string,"p_session_id": string }; Returns: string
                           },
"decide_kyc":
{ Args: { "p_application": string,"p_reason": string,"p_status": Database["public"]['Enums']["kyc_status"] }; Returns: undefined
                           },
"evaluate_coupon":
{ Args: { "p_code": string,"p_is_first_order": boolean,"p_subtotal": number,"p_user_id": string }; Returns: {
              "coupon_id": string,"discount_paise": number,"error": string
            }[]
                           },
"evaluate_installment_eligibility":
{ Args: { "p_order_total"?: number,"p_user_id": string }; Returns: Json
                           },
"expire_unpaid_orders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"find_user_for_staff":
{ Args: { "p_query": string }; Returns: {
              "email": string,"full_name": string,"id": string,"phone": string,"roles": (string)[]
            }[]
                           },
"first_order_free_available":
{ Args: { "p_exclude_order"?: string,"p_user_id": string }; Returns: boolean
                           },
"grant_initial_super_admin":
{ Args: { "p_email": string }; Returns: undefined
                           },
"has_any_role":
{ Args: { "p_roles": (string)[] }; Returns: boolean
                           },
"has_role":
{ Args: { "p_role": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"import_products":
{ Args: { "p_dry_run"?: boolean,"p_rows": Json }; Returns: Json
                           },
"installment_split":
{ Args: { "p_count": number,"p_total": number }; Returns: (number)[]
                           },
"is_service_role":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"ist_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"list_delivery_staff":
{ Args: Record<PropertyKey, never>; Returns: {
              "active_orders": number,"full_name": string,"id": string,"phone": string
            }[]
                           },
"list_staff":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"full_name": string,"id": string,"phone": string,"roles": (string)[]
            }[]
                           },
"loyalty_balance":
{ Args: { "p_user"?: string }; Returns: number
                           },
"my_delivery_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "amount_paid_paise": number,"created_at": string,"is_delayed": boolean,"items": number,"latitude": number,"longitude": number,"order_id": string,"order_number": string,"scheduled_date": string,"shipping_address": Json,"status": Database["public"]['Enums']["order_status"],"total_paise": number
            }[]
                           },
"my_installment_eligibility":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_referral_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_roles":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"payment_intent_for_order":
{ Args: { "p_installment"?: string,"p_order": string }; Returns: Json
                           },
"place_order":
{ Args: { "p_address": Json,"p_agreement_version"?: string,"p_coupon_code"?: string,"p_customer_note"?: string,"p_items": Json,"p_payment_mode"?: Database["public"]['Enums']["payment_mode"] }; Returns: Json
                           },
"preview_or_import_products":
{ Args: { "p_dry_run"?: boolean,"p_rows": Json }; Returns: Json
                           },
"product_installment_eligible":
{ Args: { "p_product_id": string }; Returns: boolean
                           },
"product_reviews":
{ Args: { "p_limit"?: number,"p_product": string }; Returns: Json
                           },
"queue_installment_reminders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"quote_cart":
{ Args: { "p_coupon_code"?: string,"p_items": Json,"p_pincode"?: string }; Returns: Json
                           },
"record_checkout_expired":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"record_checkout_paid":
{ Args: { "p_amount": number,"p_currency": string,"p_livemode": boolean,"p_payment_intent": string,"p_session_id": string }; Returns: Json
                           },
"record_delivery_attempt":
{ Args: { "p_latitude"?: number,"p_longitude"?: number,"p_note"?: string,"p_order": string,"p_outcome": string,"p_rescheduled_for"?: string }; Returns: undefined
                           },
"record_refund":
{ Args: { "p_amount": number,"p_payment_intent": string,"p_reason"?: string,"p_status": string,"p_stripe_refund_id": string }; Returns: Json
                           },
"redeem_points":
{ Args: { "p_points": number }; Returns: Json
                           },
"refresh_installment_statuses":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"remove_demo_products":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"report_delay":
{ Args: { "p_new_max_date"?: string,"p_note": string,"p_order": string }; Returns: undefined
                           },
"resolve_pincode":
{ Args: { "p_pincode": string }; Returns: {
              "city": string,"fee_override_paise": number,"is_remote": boolean,"max_days": number,"min_days": number,"serviceable": boolean,"state": string,"zone_code": string,"zone_id": string,"zone_name": string
            }[]
                           },
"search_products":
{ Args: { "p_brands"?: (string)[],"p_category"?: string,"p_featured"?: boolean,"p_ids"?: (string)[],"p_in_stock"?: boolean,"p_limit"?: number,"p_max_paise"?: number,"p_min_paise"?: number,"p_offset"?: number,"p_query"?: string,"p_sort"?: string,"p_tag"?: string }; Returns: Json
                           },
"set_default_address":
{ Args: { "p_address": string }; Returns: undefined
                           },
"set_staff_role":
{ Args: { "p_grant": boolean,"p_role": Database["public"]['Enums']["app_role"],"p_user_id": string }; Returns: undefined
                           },
"setting":
{ Args: { "p_key": string }; Returns: Json
                           },
"transition_order":
{ Args: { "p_customer_visible"?: boolean,"p_note"?: string,"p_order": string,"p_to": Database["public"]['Enums']["order_status"] }; Returns: undefined
                           },
"update_collection_task":
{ Args: { "p_note"?: string,"p_promised_date"?: string,"p_status": string,"p_task": string }; Returns: undefined
                           },
"update_setting":
{ Args: { "p_key": string,"p_value": Json }; Returns: undefined
                           },
"waive_installment":
{ Args: { "p_installment": string,"p_reason": string }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "super_admin"|"operations"|"delivery"|"collections"|"support","installment_status": "scheduled"|"due"|"paid"|"overdue"|"waived"|"cancelled","kyc_status": "not_started"|"pending"|"approved"|"rejected"|"manual_review","order_status": "order_placed"|"payment_pending"|"payment_confirmed"|"awaiting_approval"|"order_confirmed"|"processing"|"packed"|"dispatched"|"in_transit"|"out_for_delivery"|"delivered"|"delayed"|"delivery_failed"|"cancelled"|"return_requested"|"returned"|"refunded","payment_mode": "full"|"installment","payment_status": "pending"|"succeeded"|"failed"|"expired"|"refunded"|"partially_refunded"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["super_admin", "operations", "delivery", "collections", "support"],"installment_status": ["scheduled", "due", "paid", "overdue", "waived", "cancelled"],"kyc_status": ["not_started", "pending", "approved", "rejected", "manual_review"],"order_status": ["order_placed", "payment_pending", "payment_confirmed", "awaiting_approval", "order_confirmed", "processing", "packed", "dispatched", "in_transit", "out_for_delivery", "delivered", "delayed", "delivery_failed", "cancelled", "return_requested", "returned", "refunded"],"payment_mode": ["full", "installment"],"payment_status": ["pending", "succeeded", "failed", "expired", "refunded", "partially_refunded"]
          }
        }
} as const
