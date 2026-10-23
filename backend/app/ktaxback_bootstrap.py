"""K-TAXBACK catalogue bootstrap directly from the ORIGINAL SQLite audit (columns,
types, composite primary keys).  Creates EMPTY tables; never imports old rows.
"""
from sqlalchemy import (Column, Float, Identity, Index, Integer, MetaData,
                        PrimaryKeyConstraint, Table, Text, UniqueConstraint, inspect, text)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

# Exact existing table columns/types/primary keys from ktaxback_catalog_profile.json.
# String pattern: name (text), name# (integer), name$ (real); an asterisk = PK.
SCHEMA = {
 "brands": "brand_no* brand_url_name brand_name kor_brand_name first_letter new_yn brand_desc logo_image_path product_count#",
 "categories": "category_id* category_name parent_id depth# product_count#",
 "category_filters": "filter_id#* category_id filter_group option_name option_count#",
 "attribute_defs": "attr_id* attr_group group_code attr_name",
 "products": "prdt_no* brand_no category_id prdt_name prdt_name_kor nrml_amt$ min_nrml_amt$ max_nrml_amt$ sale_amt$ min_sale_amt$ max_sale_amt$ event_slprc_dscnt_rt$ discount_rate$ image_path best_yn new_yn flash_yn selling_fast_yn gift_yn sold_out_yn review_cnt# avg_score$ min_buy_qty# max_buy_qty# option_name registered_at",
 "product_images": "image_id#* prdt_no image_path image_type sort_order# lang_code",
 "product_options": "option_id#* prdt_no option_name sale_amt$ in_stock# is_default#",
 "product_details": "prdt_no* lang_code* why_we_love_it featured_ingredients how_to_use",
 "product_attributes": "prdt_no* attr_id attr_name*",
 "product_relations": "prdt_no* related_prdt_no* relation_type* lang_code* sort_order#",
 "product_translations": "prdt_no* lang_code* field_key* source_text translated_text",
 "category_names_i18n": "category_id* lang_code* category_name",
 "category_filters_i18n": "category_id* lang_code* filter_group* option_name* option_count#",
 "product_names_i18n": "prdt_no* lang_code* prdt_name",
 "product_breadcrumb_i18n": "prdt_no* lang_code* breadcrumb"
}
NOT_NULL={
 "brands":"brand_name", "categories":"category_name depth",
 "category_filters":"category_id filter_group option_name option_count",
 "attribute_defs":"attr_group attr_name", "products":"prdt_name nrml_amt sale_amt",
 "product_images":"prdt_no image_path image_type lang_code",
 "product_options":"prdt_no option_name",
 "product_details":"prdt_no lang_code", "product_attributes":"prdt_no attr_name",
 "product_relations":"prdt_no related_prdt_no relation_type lang_code",
 "product_translations":"prdt_no lang_code field_key",
 "category_names_i18n":"category_id lang_code category_name",
 "category_filters_i18n":"category_id lang_code filter_group option_name"
}
PK_IDENTITY={"filter_id","image_id","option_id"}
# From original C:\tour\olive.py CATEGORY_MAP, including root and new categories.
ORIGINAL_CATEGORIES = """1000000001 1000000003 1000000004 1000000005 1000000006 1000000007 1000000008 1000000009 1000000010 1000000011 1000000012 1000000013 1000000014 1000000015 1000000016 1000000017 1000000018 1000000019 1000000020 1000000021 1000000022 1000000023 1000000024 1000000025 1000000026 1000000027 1000000028 1000000029 1000000030 1000000031 1000000032 1000000033 1000000034 1000000035 1000000036 1000000037 1000000038 1000000039 1000000040 1000000041 1000000042 1000000043 1000000044 1000000045 1000000046 1000000047 1000000048 1000000049 1000000052 1000000053 1000000054 1000000055 1000000056 1000000057 1000000058 1000000060 1000000061 1000000062 1000000063 1000000064 1000000065 1000000066 1000000069 1000000070 1000000071 1000000072 1000000073 1000000074 1000000075 1000000077 1000000078 1000000079 1000000081 1000000082 1000000083 1000000084 1000000085 1000000086 1000000087 1000000088 1000000089 1000000090 1000000091 1000000092 1000000094 1000000095 1000000096 1000000097 1000000098 1000000099 1000000100 1000000101 1000000102 1000000103 1000000105 1000000107 1000000112 1000000113 1000000114 1000000118 1000000119 1000000120 1000000121 1000000122 1000000123 1000000124 1000000125 1000000126 1000000127 1000000128 1000000129 1000000130 1000000131 1000000132 1000000133 1000000134 1000000135 1000000136 1000000137 1000000138 1000000139 1000000144 1000000145 1000000146 1000000147 1000000148 1000000149 1000000151 1000000152 1000000153 1000000154 1000000155 1000000162 1000000179 1000000183 1000000205 1000000206 1000000207 1000000208 2000000001 1000000209 1000000242 1000000244 1000000247 1000000248 1000000261 1000000265 1000000266 1000000267 1000000268""".split()
PREFIX="korea_prebook_kt_"

def bootstrap(engine):
    metadata=MetaData()
    for name,spec in SCHEMA.items():
        parts=[(x.rstrip("#$*"), "#" in x, "$" in x, "*" in x) for x in spec.split()]
        key=[x[0] for x in parts if x[3]]
        notnull=set(NOT_NULL.get(name,"").split())
        cols=[]
        for field,is_int,is_float,is_pk in parts:
            typ=Integer if is_int else Float if is_float else Text
            kw={"nullable":False if field in notnull or is_pk else True}
            if field in PK_IDENTITY and is_pk and engine.dialect.name=="postgresql":
                cols.append(Column(field, typ, Identity(), **kw))
            else:cols.append(Column(field, typ, **kw))
        rules=[UniqueConstraint("category_id","filter_group","option_name")]
        if name!="category_filters":rules=[]
        Table(PREFIX+name, metadata,*cols,PrimaryKeyConstraint(*key),*rules)
    metadata.create_all(engine, checkfirst=True)
    # No modifications to already existing original K-TAXBACK tables.
    for name,spec in SCHEMA.items():
        expected={x.rstrip("#$*") for x in spec.split()}
        actual={c["name"] for c in inspect(engine).get_columns(PREFIX+name)}
        if actual!=expected:
            raise RuntimeError("K-TAXBACK table schema conflict: "+name)
    reg=Table(PREFIX+"definitions",MetaData(),autoload_with=engine)
    with engine.begin() as con:
        for name in SCHEMA:
            stmt=(pg_insert if engine.dialect.name=="postgresql" else sqlite_insert)(
                reg
            ).values(name=name,description="created empty from original schema")
            con.execute(stmt.on_conflict_do_nothing(index_elements=["name"]))
        con.execute(text("""CREATE TABLE IF NOT EXISTS korea_prebook_kt_category_targets
         (category_id TEXT PRIMARY KEY, priority INTEGER NOT NULL,
          display_name TEXT, last_state TEXT, last_error TEXT, last_checked TEXT,
          last_products INTEGER NOT NULL DEFAULT 0)"""))
        # All 150 category IDs are from olive.py; no old product data inserted.
        for position,cid in enumerate(ORIGINAL_CATEGORIES):
            con.execute(text("""INSERT INTO korea_prebook_kt_category_targets
                 (category_id,priority,last_products) VALUES(:id,:p,0)
                 ON CONFLICT(category_id) DO NOTHING"""),{"id":cid,"p":position})
    return len(ORIGINAL_CATEGORIES)
