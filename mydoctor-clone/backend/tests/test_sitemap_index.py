import unittest
from app.sitemap_index import extract_locs,section_of,BASE

class SitemapUnitTests(unittest.TestCase):
    def test_index_and_urlset(self):
        xml=b'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://my-doctor.io/sitemaps/medicine/medicine.xml</loc></sitemap></sitemapindex>'
        self.assertEqual(extract_locs(xml,"sitemapindex"),["https://my-doctor.io/sitemaps/medicine/medicine.xml"])
        xml2=b'<urlset><url><loc>https://my-doctor.io/hospital/detail?hospital_id=323</loc></url><url><loc>https://my-doctor.io/hospital/detail?hospital_id=323</loc></url></urlset>'
        self.assertEqual(len(extract_locs(xml2,"urlset")),1)
    def test_host_rejection(self):
        xml=b'<urlset><url><loc>https://unknown.test/patient</loc></url></urlset>'
        with self.assertRaises(ValueError):extract_locs(xml,"urlset")
    def test_section_names(self):
        self.assertEqual(section_of(BASE+"/hospital/detail?hospital_id=323"),"hospital-detail")
        self.assertEqual(section_of(BASE+"/telemedicine/doctor/known-id"),"doctor")
        self.assertEqual(section_of(BASE+"/medical-cost/마운자로"),"medical-cost")
if __name__=="__main__":unittest.main()
