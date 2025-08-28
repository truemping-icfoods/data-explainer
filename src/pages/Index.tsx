import CSVUpload from "@/components/CSVUpload";

const Index = () => {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">CSV File Upload</h1>
          <p className="text-xl text-muted-foreground">Upload your CSV files to E2C Starter database</p>
        </div>
        <CSVUpload />
      </div>
    </div>
  );
};

export default Index;
